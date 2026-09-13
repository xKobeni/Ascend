import type { CraftingRecipe, CraftingRecipeId, CraftingSnapshot } from "../crafting/CraftingSystem";
import { getRepairQuote } from "../crafting/CraftingSystem";
import type { EquipmentSnapshot } from "../equipment/EquipmentSystem";
import type { ExpeditionResources } from "../expeditions/Expedition";

interface SmithyActions {
  close(): void;
  craft(recipeId: CraftingRecipeId): void;
  repair(itemId: string): void;
}

export interface SmithyViewState {
  crafting: Readonly<CraftingSnapshot>;
  equipment: Readonly<EquipmentSnapshot>;
  recipes: readonly Readonly<CraftingRecipe>[];
  resources: Readonly<ExpeditionResources>;
}

export class SmithyOverlay {
  private readonly element: HTMLElement;
  private renderedSignature = "";

  constructor(container: HTMLElement, private readonly actions: SmithyActions) {
    this.element = document.createElement("section");
    this.element.className = "smithy-overlay";
    this.element.hidden = true;
    this.element.setAttribute("aria-label", "Smithy workshop");
    this.element.addEventListener("click", this.handleClick);
    container.appendChild(this.element);
  }

  open(): void {
    this.renderedSignature = "";
    this.element.hidden = false;
  }

  close(): void { this.element.hidden = true; }
  isOpen(): boolean { return !this.element.hidden; }

  update(state: Readonly<SmithyViewState>): void {
    if (this.element.hidden) return;
    const signature = `${state.crafting.revision}:${state.equipment.revision}:${state.resources.metal}:${state.resources.scrap}`;
    if (signature === this.renderedSignature) return;
    this.renderedSignature = signature;
    const active = this.element.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    const focusSelector = active?.dataset.craftRecipe ? `[data-craft-recipe="${active.dataset.craftRecipe}"]`
      : active?.dataset.repairItem ? `[data-repair-item="${active.dataset.repairItem}"]`
        : active?.dataset.smithyAction ? `[data-smithy-action="${active.dataset.smithyAction}"]`
          : null;
    const busy = state.crafting.activeJob !== null;
    const job = state.crafting.activeJob;
    const progress = job ? Math.round(job.progressMinutes / job.durationMinutes * 100) : 0;
    const damaged = state.equipment.items.filter((item) => item.durability < 100);
    const completion = state.crafting.lastCompletion;
    this.element.innerHTML = `
      <div class="smithy-overlay__scrim" data-smithy-action="close"></div>
      <aside class="smithy-panel">
        <header class="smithy-panel__header">
          <div><span>REFUGE WORKSHOP</span><h2>Smithy</h2><p>Turn recovered Metal and Scrap into field equipment.</p></div>
          <button type="button" data-smithy-action="close" aria-label="Close Smithy">×</button>
        </header>
        <div class="smithy-resources" aria-label="Available smithy resources">
          <span><i>METAL</i><b>${state.resources.metal}</b></span>
          <span><i>SCRAP</i><b>${state.resources.scrap}</b></span>
        </div>
        ${job ? `
          <section class="smithy-job" data-job-kind="${job.kind}">
            <span>${job.kind.toUpperCase()} IN PROGRESS</span><strong>${this.escape(job.label)}</strong>
            <progress max="100" value="${progress}"></progress>
            <small>${progress}% · ${Math.ceil(job.durationMinutes - job.progressMinutes)} game minutes remain</small>
          </section>
        ` : completion ? `
          <section class="smithy-completion">
            <span>LAST WORK COMPLETED</span><strong>${completion.kind === "Repair" ? "Equipment restored" : `${completion.quality ?? "Normal"} item forged`}</strong>
          </section>
        ` : `<p class="smithy-idle">The forge is ready for one timed job.</p>`}
        <section class="smithy-section">
          <div class="smithy-section__heading"><div><span>FORGE</span><h3>Equipment recipes</h3></div><small>Normal · Good · Excellent</small></div>
          <div class="smithy-recipes">
            ${state.recipes.map((recipe) => this.renderRecipe(recipe, state.resources, busy)).join("")}
          </div>
          <p class="smithy-quality-note">Quality is rolled when work completes. Hero smith skill remains a future quality modifier.</p>
        </section>
        <section class="smithy-section smithy-repairs">
          <div class="smithy-section__heading"><div><span>MAINTAIN</span><h3>Repair equipment</h3></div><small>Restores 100% condition</small></div>
          ${damaged.length === 0 ? `<p>No damaged equipment.</p>` : damaged.map((item) => {
            const quote = getRepairQuote(item);
            const disabled = busy || state.resources.metal < quote.metalCost || state.resources.scrap < quote.scrapCost;
            return `<article><div><strong>${this.escape(item.name)}</strong><small>${item.durability}% condition · ${Math.ceil(quote.durationMinutes)} min</small></div><button type="button" data-repair-item="${item.id}" ${disabled ? "disabled" : ""}>Repair · ${quote.metalCost} Metal + ${quote.scrapCost} Scrap</button></article>`;
          }).join("")}
        </section>
      </aside>
    `;
    this.element.querySelector<HTMLButtonElement>(focusSelector ?? "[data-smithy-action='close']")?.focus();
  }

  dispose(): void {
    this.element.removeEventListener("click", this.handleClick);
    this.element.remove();
  }

  private renderRecipe(
    recipe: Readonly<CraftingRecipe>,
    resources: Readonly<ExpeditionResources>,
    busy: boolean,
  ): string {
    const disabled = busy || resources.metal < recipe.metalCost || resources.scrap < recipe.scrapCost;
    const stats = recipe.output.stats;
    const statLine = stats.damage > 0 ? `+${stats.damage} damage${stats.range > 0 ? ` · +${stats.range} range` : ""}` : `+${stats.defense} defense`;
    return `<article class="smithy-recipe"><div><span>${recipe.output.type} · ${Math.round(recipe.durationMinutes / 60 * 10) / 10}h</span><strong>${recipe.name}</strong><p>${recipe.description}</p><small>${statLine}</small></div><button type="button" data-craft-recipe="${recipe.id}" ${disabled ? "disabled" : ""}>Forge · ${recipe.metalCost} Metal + ${recipe.scrapCost} Scrap</button></article>`;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const close = target?.closest<HTMLElement>("[data-smithy-action='close']");
    if (close) {
      this.actions.close();
      return;
    }
    const button = target?.closest<HTMLButtonElement>("button");
    if (!button || button.disabled) return;
    const recipeId = button.dataset.craftRecipe;
    if (this.isRecipeId(recipeId)) this.actions.craft(recipeId);
    if (button.dataset.repairItem) this.actions.repair(button.dataset.repairItem);
  };

  private isRecipeId(value: string | undefined): value is CraftingRecipeId {
    return value !== undefined && ["iron-sword", "ranger-spear", "ward-shield"].includes(value);
  }

  private escape(value: string): string {
    const node = document.createElement("span");
    node.textContent = value;
    return node.innerHTML;
  }
}
