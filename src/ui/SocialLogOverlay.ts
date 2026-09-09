import type { SocialEvent } from "../heroes/RelationshipSystem";

export class SocialLogOverlay {
  private readonly element: HTMLElement;
  private latestEventId = 0;

  constructor(container: HTMLElement) {
    this.element = document.createElement("aside");
    this.element.className = "social-log";
    this.element.setAttribute("aria-label", "Settlement social log");
    this.element.setAttribute("aria-live", "polite");
    this.element.innerHTML = `
      <div class="social-log__title">Settlement log</div>
      <div class="social-log__empty">Waiting for social activity…</div>
      <ol></ol>
    `;
    container.appendChild(this.element);
  }

  update(events: readonly Readonly<SocialEvent>[]): void {
    const latest = events[0];
    if (!latest || latest.id === this.latestEventId) {
      return;
    }
    this.latestEventId = latest.id;
    const list = this.element.querySelector("ol");
    const empty = this.element.querySelector<HTMLElement>(".social-log__empty");
    if (!list || !empty) {
      throw new Error("Social log structure is incomplete.");
    }
    empty.hidden = true;
    list.replaceChildren(
      ...events.slice(0, 4).map((event) => {
        const item = document.createElement("li");
        const time = document.createElement("time");
        const message = document.createElement("span");
        const hours = Math.floor(event.minuteOfDay / 60);
        const minutes = Math.floor(event.minuteOfDay % 60);
        time.textContent = `D${event.day} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        message.textContent = event.message;
        item.dataset.eventType = event.type;
        item.append(time, message);
        return item;
      }),
    );
  }

  dispose(): void {
    this.element.remove();
  }
}
