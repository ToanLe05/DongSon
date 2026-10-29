export default class ChoiceDialog {
    constructor(document = globalThis.document) {
        this.document = document;
        this.cancel = () => {};
    }

    open({ title, description, choices, cancelLabel = "Hủy", className = "" }) {
        this.cancel();
        return new Promise((resolve, reject) => {
            const dialog = this.document.createElement("dialog");
            dialog.className = "choice-dialog " + className;
            const heading = this.document.createElement("h2");
            heading.textContent = title;
            dialog.setAttribute("aria-label", title);
            dialog.append(heading);
            if (description) {
                const text = this.document.createElement("p");
                text.textContent = description;
                dialog.append(text);
            }
            const actions = this.document.createElement("div");
            actions.className = "dialog-actions";
            dialog.append(actions);
            let settled = false;
            const finish = value => {
                if (settled) return;
                settled = true;
                dialog.close();
                dialog.remove();
                this.cancel = () => {};
                resolve(value);
            };
            this.cancel = () => finish(null);
            for (const [index, choice] of choices.entries()) {
                const button = this.document.createElement("button");
                button.type = "button";
                button.className = "btn btn-primary";
                button.textContent = choice.label;
                button.dataset.choice = choice.value;
                button.autofocus = index === 0;
                button.addEventListener("click", () => finish(choice.value), { once: true });
                actions.append(button);
            }
            const cancel = this.document.createElement("button");
            cancel.type = "button";
            cancel.className = "btn btn-ghost";
            cancel.textContent = cancelLabel;
            cancel.addEventListener("click", () => finish(null), { once: true });
            actions.append(cancel);
            dialog.addEventListener("cancel", event => { event.preventDefault(); finish(null); });
            dialog.addEventListener("close", () => finish(null));
            try {
                this.document.body.append(dialog);
                dialog.showModal();
            } catch (error) {
                settled = true;
                dialog.remove();
                this.cancel = () => {};
                reject(error);
            }
        });
    }
}
