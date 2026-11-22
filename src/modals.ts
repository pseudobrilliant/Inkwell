import { App, Modal, Setting, SuggestModal } from "obsidian";

export interface FormField<K extends string = string> {
  key: K;
  label: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  type?: "text" | "number";
}

/** A small form. Resolves to the trimmed values (one per field key), or null if cancelled. */
export function askForm<K extends string>(
  app: App,
  title: string,
  fields: FormField<K>[],
  submitText = "Create",
  description = ""
): Promise<Record<K, string> | null> {
  return new Promise((resolve) => {
    const modal = new (class extends Modal {
      values: Record<string, string> = {};
      done = false;
      onOpen() {
        this.setTitle(title);
        if (description) {
          for (const para of description.split("\n\n")) this.contentEl.createEl("p", { text: para });
        }
        let first: HTMLInputElement | null = null;
        for (const f of fields) {
          this.values[f.key] = f.value ?? "";
          new Setting(this.contentEl).setName(f.label).addText((t) => {
            t.setPlaceholder(f.placeholder ?? "").setValue(f.value ?? "");
            if (f.type === "number") t.inputEl.type = "number";
            t.onChange((v) => (this.values[f.key] = v));
            t.inputEl.addEventListener("keydown", (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                this.submit();
              }
            });
            first ??= t.inputEl;
          });
        }
        new Setting(this.contentEl).addButton((b) =>
          b.setButtonText(submitText).setCta().onClick(() => this.submit())
        );
        window.setTimeout(() => first?.focus(), 0);
      }
      submit() {
        for (const f of fields) {
          if (f.required && !this.values[f.key]?.trim()) return;
        }
        this.done = true;
        const out = {} as Record<K, string>;
        for (const f of fields) out[f.key] = (this.values[f.key] ?? "").trim();
        resolve(out);
        this.close();
      }
      onClose() {
        this.contentEl.empty();
        if (!this.done) resolve(null);
      }
    })(app);
    modal.open();
  });
}

/** Pick one item from a list. Resolves to the item, or null if cancelled. */
export function pick<T>(
  app: App,
  items: T[],
  label: (t: T) => string,
  placeholder = ""
): Promise<T | null> {
  return new Promise((resolve) => {
    let chosen = false;
    const modal = new (class extends SuggestModal<T> {
      getSuggestions(q: string) {
        const lq = q.toLowerCase();
        return items.filter((i) => label(i).toLowerCase().includes(lq));
      }
      renderSuggestion(item: T, el: HTMLElement) {
        el.setText(label(item));
      }
      onChooseSuggestion(item: T) {
        chosen = true;
        resolve(item);
      }
      onClose() {
        // onClose fires before onChooseSuggestion; wait a tick.
        window.setTimeout(() => {
          if (!chosen) resolve(null);
        }, 0);
      }
    })(app);
    modal.setPlaceholder(placeholder);
    modal.open();
  });
}
