import * as THREE from "three";

import { markSelectable, type SelectionDetails } from "./SelectionRaycaster";
import type { FallenHeroRecord } from "../heroes/Hero";
import {
  RefugeLayoutSystem,
  type RefugeLayoutSnapshot,
  type RefugeStructureId,
} from "../refuge/RefugeLayoutSystem";
import { placeObjectOnRefugeGround, REFUGE_GROUND_Y } from "./RefugeGround";
import type { ConstructionSnapshot, ConstructionSite, FacilityRecipeId } from "../refuge/ConstructionSystem";
import { FACILITY_RECIPES } from "../refuge/ConstructionSystem";

interface FacilityRenderObject {
  anchorRotation: number;
  anchorX: number;
  anchorZ: number;
  baseRotation: number;
  object: THREE.Object3D;
  offsetX: number;
  offsetZ: number;
}

export interface RefugeBuildPreview {
  radius: number;
  rotation: number;
  valid: boolean;
  x: number;
  z: number;
}

export class ProceduralBaseScene {
  private constructionRevision = -1;
  private readonly constructionRoot = new THREE.Group();
  private readonly constructionSelectionRoots = new Set<THREE.Object3D>();
  private readonly environmentRoot = new THREE.Group();
  private readonly environmentSelectionRoots = new Set<THREE.Object3D>();
  private readonly facilityObjects = new Map<RefugeStructureId, FacilityRenderObject[]>();
  private readonly grid: THREE.GridHelper;
  private layoutRevision = -1;
  private readonly memorialAnchor = new THREE.Group();
  private readonly memorialRoots = new Map<string, THREE.Group>();
  private readonly previewRoot = new THREE.Group();

  private readonly fireGlow = new THREE.PointLight("#ff8a45", 54, 27, 2);
  private readonly flameCore: THREE.Mesh;
  private readonly root = new THREE.Group();

  constructor(
    private readonly scene: THREE.Scene,
    readonly selectableRoots: THREE.Object3D[] = [],
    layout: Readonly<RefugeLayoutSnapshot> = new RefugeLayoutSystem().getSnapshot(),
  ) {
    this.root.name = "Procedural Refuge";
    this.scene.background = new THREE.Color("#111820");
    this.scene.fog = new THREE.Fog("#111820", 66, 144);

    this.addLighting();
    this.grid = this.addGround();
    this.addCommandHall();
    this.flameCore = this.addCampfire();
    this.addTent();
    this.addInfirmary();
    this.addTrainingDummy();
    this.addCrates();
    this.addStoragePile();
    this.addDimensionalGate();
    this.addMemorialGrounds();
    this.createBuildPreview();
    this.constructionRoot.name = "Refuge Construction";
    this.root.add(this.constructionRoot);
    this.environmentRoot.name = "Refuge Layout Environment";
    this.root.add(this.environmentRoot);
    this.scene.add(this.root);
    this.syncLayout(layout);
  }

  update(timestampSeconds: number): void {
    const flicker = 1 + Math.sin(timestampSeconds * 9.5) * 0.07 + Math.sin(timestampSeconds * 15.2) * 0.04;
    this.flameCore.scale.set(flicker, 0.95 + flicker * 0.08, flicker);
    this.fireGlow.intensity = 54 + Math.sin(timestampSeconds * 11) * 6.6;
  }

  syncMemorials(records: readonly Readonly<FallenHeroRecord>[]): void {
    const activeIds = new Set(records.map((record) => record.heroId));
    this.memorialRoots.forEach((root, heroId) => {
      if (activeIds.has(heroId)) {
        return;
      }
      this.removeSelectableRoot(root);
      this.disposeObject(root);
      this.memorialRoots.delete(heroId);
    });
    records.forEach((record, index) => {
      let root = this.memorialRoots.get(record.heroId);
      if (!root) {
        root = this.addMemorial(record);
        this.memorialRoots.set(record.heroId, root);
      }
      const column = index % 5;
      const row = Math.floor(index / 5);
      root.position.set(-5.2 + column * 2.55, 0.06, -1.1 + row * 2.4);
      if (root.parent !== this.memorialAnchor) this.memorialAnchor.add(root);
    });
  }

  syncLayout(layout: Readonly<RefugeLayoutSnapshot>): void {
    if (layout.revision === this.layoutRevision) {
      return;
    }
    layout.facilities.forEach((facility) => {
      const objects = this.facilityObjects.get(facility.id) ?? [];
      objects.forEach((record) => {
        record.object.visible = facility.placed;
        if (!facility.placed) return;
        const rotationDelta = facility.rotation - record.anchorRotation;
        const cosine = Math.cos(rotationDelta);
        const sine = Math.sin(rotationDelta);
        record.object.position.x = facility.x + record.offsetX * cosine - record.offsetZ * sine;
        record.object.position.z = facility.z + record.offsetX * sine + record.offsetZ * cosine;
        record.object.rotation.y = record.baseRotation + rotationDelta;
      });
    });
    this.rebuildEnvironment(layout);
    this.layoutRevision = layout.revision;
  }

  syncConstructions(snapshot: Readonly<ConstructionSnapshot>): void {
    if (snapshot.revision === this.constructionRevision) return;
    this.constructionSelectionRoots.forEach((root) => this.removeSelectableRoot(root));
    this.constructionSelectionRoots.clear();
    while (this.constructionRoot.children.length > 0) {
      const child = this.constructionRoot.children[0];
      if (!child) break;
      this.disposeObject(child);
    }
    snapshot.sites.forEach((site) => this.addConstruction(site));
    this.constructionRevision = snapshot.revision;
  }

  setBuildMode(active: boolean): void {
    this.grid.visible = false;
    if (!active) {
      this.previewRoot.visible = false;
    }
  }

  setBuildPreview(preview: Readonly<RefugeBuildPreview> | null): void {
    if (!preview) {
      this.previewRoot.visible = false;
      return;
    }
    this.previewRoot.visible = true;
    this.previewRoot.position.set(preview.x, REFUGE_GROUND_Y + 0.05, preview.z);
    this.previewRoot.rotation.y = preview.rotation;
    this.previewRoot.scale.set(preview.radius, 1, preview.radius);
    const color = preview.valid ? "#747b5d" : "#7a4545";
    this.previewRoot.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshBasicMaterial) material.color.set(color);
        });
      }
    });
  }

  dispose(): void {
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) {
        return;
      }
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.root.removeFromParent();
    this.scene.fog = null;
  }

  private addLighting(): void {
    const ambient = new THREE.HemisphereLight("#c9e5ec", "#24211d", 1.5);
    this.root.add(ambient);

    const sun = new THREE.DirectionalLight("#ffe6c5", 3.1);
    sun.position.set(-30, 48, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 135;
    sun.shadow.bias = -0.0004;
    this.root.add(sun);
  }

  private addGround(): THREE.GridHelper {
    const surroundingGround = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshStandardMaterial({ color: "#182019", roughness: 1 }),
    );
    surroundingGround.rotation.x = -Math.PI / 2;
    surroundingGround.position.y = -0.32;
    surroundingGround.receiveShadow = true;
    this.root.add(surroundingGround);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(72, 72),
      new THREE.MeshStandardMaterial({ color: "#4f5945", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = REFUGE_GROUND_Y;
    ground.receiveShadow = true;
    this.root.add(ground);

    const patchMaterial = new THREE.MeshStandardMaterial({ color: "#5e5b43", roughness: 1, transparent: true, opacity: 0.48 });
    [
      [-25, -2, 7, 4, 0.3], [26, 20, 8, 4, -0.4], [18, -25, 6, 3, 0.9],
      [-17, 24, 5, 8, -0.7], [7, 16, 4, 7, 0.45], [-5, -22, 8, 3, 0.15],
    ].forEach(([x, z, sx, sz, rotation]) => {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(1, 18), patchMaterial.clone());
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = rotation ?? 0;
      patch.position.set(x ?? 0, 0.292, z ?? 0);
      patch.scale.set(sx ?? 1, sz ?? 1, 1);
      this.root.add(patch);
    });

    const grid = new THREE.GridHelper(72, 36, "#a78652", "#77745f");
    grid.position.y = 0.31;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.18;
    });
    this.root.add(grid);
    grid.visible = false;
    return grid;
  }

  private addCommandHall(): void {
    const group = this.createSelectableGroup({ category: "base", id: "command-hall", label: "Command Hall" });
    group.position.set(0, 0.38, -10);
    this.registerFacilityObject("command-hall", group, 0, -10, 0);
    const wall = new THREE.MeshStandardMaterial({ color: "#b99d76", roughness: 0.94 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: "#57483a", roughness: 0.98 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4.4, 6.2), wall);
    body.position.y = 2.2;
    body.castShadow = true;
    body.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.8, 4), roofMaterial);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 5.75;
    roof.castShadow = true;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.7, 0.22), new THREE.MeshStandardMaterial({ color: "#35291f", roughness: 1 }));
    door.position.set(0, 1.35, 3.18);
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.28, 1.2), new THREE.MeshStandardMaterial({ color: "#777066", roughness: 1 }));
    step.position.set(0, 0.14, 3.55);
    group.add(body, roof, door, step);
    placeObjectOnRefugeGround(group);
  }

  private addCampfire(): THREE.Mesh {
    const group = this.createSelectableGroup({ category: "prop", id: "campfire", label: "Campfire" });
    group.position.set(0, 1.08, 5);
    this.registerFacilityObject("campfire", group, 0, 5, 0);

    const stoneMaterial = new THREE.MeshStandardMaterial({ color: "#55534d", roughness: 1 });
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.66, 0), stoneMaterial);
      stone.position.set(Math.cos(angle) * 2.34, 0.54, Math.sin(angle) * 2.34);
      stone.scale.set(1.2, 0.72, 0.9);
      stone.castShadow = true;
      group.add(stone);
    }

    const logMaterial = new THREE.MeshStandardMaterial({ color: "#4d2f21", roughness: 1 });
    for (const rotation of [-0.72, 0.72]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.51, 3.45, 8), logMaterial);
      log.rotation.set(Math.PI / 2, 0, rotation);
      log.position.y = 0.9;
      log.castShadow = true;
      group.add(log);
    }

    const outerFlame = new THREE.Mesh(
      new THREE.ConeGeometry(1.44, 3.75, 7),
      new THREE.MeshStandardMaterial({ color: "#f0783d", emissive: "#9b2f15", emissiveIntensity: 1.8 }),
    );
    outerFlame.position.y = 3.06;
    group.add(outerFlame);

    const flameCore = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 2.28, 7),
      new THREE.MeshBasicMaterial({ color: "#ffd56a" }),
    );
    flameCore.position.y = 2.61;
    group.add(flameCore);

    this.fireGlow.position.y = 4.65;
    this.fireGlow.distance = 27;
    this.fireGlow.intensity = 54;
    group.add(this.fireGlow);
    placeObjectOnRefugeGround(group);
    return flameCore;
  }

  private addInfirmary(): void {
    const group = this.createSelectableGroup({
      category: "facility",
      detail: "Injured heroes recover here while resting. Treatment requires Medicine.",
      id: "infirmary",
      label: "Refuge Infirmary",
    });
    group.position.set(-21, 0.38, 11);
    group.rotation.y = -0.12;
    this.registerFacilityObject("infirmary", group, -21, 11, -0.12);
    const frameMaterial = new THREE.MeshStandardMaterial({ color: "#58463b", roughness: 0.96 });
    const clothMaterial = new THREE.MeshStandardMaterial({ color: "#747b5d", roughness: 1 });
    [-2.4, 0, 2.4].forEach((offset) => {
      const cot = new THREE.Group();
      cot.position.x = offset;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.22, 3.2), frameMaterial);
      frame.position.y = 0.28;
      const bedding = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.18, 2.85), clothMaterial);
      bedding.position.y = 0.47;
      cot.add(frame, bedding);
      group.add(cot);
    });
    placeObjectOnRefugeGround(group);
    this.root.add(group);
  }

  private addMemorial(record: Readonly<FallenHeroRecord>): THREE.Group {
    const group = this.createSelectableGroup({
      category: "memorial",
      detail: `Day ${record.joinedDay} — Day ${record.diedDay} · ${record.causeOfDeath}`,
      id: record.heroId,
      label: record.name,
    });
    const stone = new THREE.MeshStandardMaterial({ color: "#585750", roughness: 1 });
    const bronze = new THREE.MeshStandardMaterial({ color: "#8b7047", metalness: 0.18, roughness: 0.78 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.28, 1.15), stone);
    plinth.position.y = 0.14;
    plinth.castShadow = true;
    const marker = new THREE.Mesh(new THREE.BoxGeometry(1.28, 1.72, 0.42), stone);
    marker.position.set(0, 1.12, 0);
    marker.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.42, 12, 1, false, 0, Math.PI), stone);
    cap.position.set(0, 1.98, 0);
    cap.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    cap.castShadow = true;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.3, 0.08), bronze);
    plate.position.set(0, 1.18, 0.25);
    group.add(plinth, marker, cap, plate);
    return group;
  }

  private addTent(): void {
    const group = this.createSelectableGroup({ category: "facility", id: "dormitory", label: "Dormitory" });
    group.position.set(-21, 1.08, -11);
    group.rotation.y = 0.15;
    this.registerFacilityObject("dormitory", group, -21, -11, 0.15);

    const fabric = new THREE.MeshStandardMaterial({ color: "#73878a", roughness: 0.95, side: THREE.DoubleSide });
    const shelter = new THREE.Mesh(new THREE.ConeGeometry(4.65, 7.35, 4), fabric);
    shelter.position.y = 3.6;
    shelter.rotation.y = Math.PI / 4;
    shelter.castShadow = true;
    shelter.receiveShadow = true;
    group.add(shelter);

    const opening = new THREE.Mesh(
      new THREE.CircleGeometry(1.41, 3),
      new THREE.MeshBasicMaterial({ color: "#182124", side: THREE.DoubleSide }),
    );
    opening.position.set(0, 2.76, 3.72);
    opening.rotation.y = Math.PI;
    group.add(opening);
    placeObjectOnRefugeGround(group);
  }

  private addTrainingDummy(): void {
    const group = this.createSelectableGroup({ category: "facility", id: "training", label: "Training Yard" });
    group.position.set(21, 1.02, 11);
    group.rotation.y = 0.1;
    this.registerFacilityObject("training", group, 21, 11, 0.1);
    const wood = new THREE.MeshStandardMaterial({ color: "#8b6540", roughness: 0.9 });
    const bindings = new THREE.MeshStandardMaterial({ color: "#8d4f3f", roughness: 0.85 });

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.51, 7.5, 8), wood);
    post.position.y = 3.66;
    post.castShadow = true;
    group.add(post);

    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 5.1, 8), wood);
    crossbar.position.y = 4.86;
    crossbar.rotation.z = Math.PI / 2;
    crossbar.castShadow = true;
    group.add(crossbar);

    const target = new THREE.Mesh(new THREE.CylinderGeometry(1.41, 1.41, 0.72, 16), bindings);
    target.position.set(0, 4.89, 0.42);
    target.rotation.x = Math.PI / 2;
    target.castShadow = true;
    group.add(target);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.84, 10, 8), wood);
    head.position.y = 6.9;
    head.castShadow = true;
    group.add(head);
    placeObjectOnRefugeGround(group);
  }

  private addCrates(): void {
    const group = this.createSelectableGroup({ category: "facility", id: "storage", label: "Storage" });
    group.position.set(18.9, 0.99, -10.75);
    group.rotation.y = -0.08;
    this.registerFacilityObject("storage", group, 21, -10, -0.08);
    const wood = new THREE.MeshStandardMaterial({ color: "#735638", roughness: 0.9 });
    const slat = new THREE.MeshStandardMaterial({ color: "#4e3a29", roughness: 1 });
    const layouts = [
      { x: -1.65, y: 1.44, z: 0.3, size: 2.85 },
      { x: 1.44, y: 1.2, z: 1.08, size: 2.4 },
      { x: 0.15, y: 3.36, z: -0.36, size: 2.1 },
    ];
    layouts.forEach(({ x, y, z, size }) => {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), wood);
      crate.position.set(x, y, z);
      crate.rotation.y = x * 0.18;
      crate.castShadow = true;
      crate.receiveShadow = true;
      group.add(crate);
      const band = new THREE.Mesh(new THREE.BoxGeometry(size + 0.075, size * 0.12, size + 0.09), slat);
      band.position.set(x, y, z);
      band.rotation.y = crate.rotation.y;
      group.add(band);
    });
    placeObjectOnRefugeGround(group);
  }

  private addStoragePile(): void {
    const group = this.createSelectableGroup({ category: "prop", id: "storage-pile", label: "Storage Pile" });
    group.position.set(24.15, 1.14, -7.75);
    group.rotation.y = -0.08;
    this.registerFacilityObject("storage", group, 21, -10, -0.08);
    const sackMaterial = new THREE.MeshStandardMaterial({ color: "#8a8068", roughness: 1 });
    for (let index = 0; index < 5; index += 1) {
      const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(1.44, 1), sackMaterial);
      sack.position.set((index % 3) * 1.65, index > 2 ? 2.16 : 0.84, Math.sin(index) * 0.6);
      sack.scale.set(1, 0.62, 0.72);
      sack.castShadow = true;
      group.add(sack);
    }
    placeObjectOnRefugeGround(group);
  }

  private addDimensionalGate(): void {
    const group = this.createSelectableGroup({ category: "base", id: "dimensional-gate", label: "Dimensional Gate" });
    group.position.set(0, 1.08, 29);
    group.rotation.y = Math.PI;
    this.registerFacilityObject("dimensional-gate", group, 0, 29, Math.PI);
    const stone = new THREE.MeshStandardMaterial({ color: "#555361", roughness: 0.72, metalness: 0.1 });
    for (const x of [-2.85, 2.85]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.65, 8.4, 1.95), stone);
      pillar.position.set(x, 4.14, 0);
      pillar.rotation.z = -x * 0.02;
      pillar.castShadow = true;
      group.add(pillar);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.44, 2.04), stone);
    lintel.position.y = 8.34;
    lintel.castShadow = true;
    group.add(lintel);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.28, 0.13, 8, 48),
      new THREE.MeshStandardMaterial({ color: "#a78652", metalness: 0.34, roughness: 0.66 }),
    );
    ring.position.y = 4.35;
    ring.scale.y = 1.28;
    group.add(ring);
    const threshold = new THREE.Mesh(
      new THREE.CircleGeometry(2.18, 48),
      new THREE.MeshBasicMaterial({ color: "#747b5d", opacity: 0.16, transparent: true, depthWrite: false }),
    );
    threshold.position.set(0, 4.35, -0.06);
    threshold.scale.y = 1.28;
    group.add(threshold);
    placeObjectOnRefugeGround(group);
  }

  private addMemorialGrounds(): void {
    this.memorialAnchor.name = "Memorial Grounds";
    this.memorialAnchor.position.set(0, 0.34, -29);
    markSelectable(this.memorialAnchor, { category: "base", id: "memorial-grounds", label: "Memorial Grounds" });
    this.selectableRoots.push(this.memorialAnchor);
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(5.1, 5.35, 0.16, 18),
      new THREE.MeshStandardMaterial({ color: "#54564c", roughness: 1 }),
    );
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.memorialAnchor.add(ground);
    placeObjectOnRefugeGround(this.memorialAnchor);
    this.root.add(this.memorialAnchor);
    this.registerFacilityObject("memorial-grounds", this.memorialAnchor, 0, -29, 0);
  }

  private createSelectableGroup(details: SelectionDetails): THREE.Group {
    const group = new THREE.Group();
    group.name = details.label;
    markSelectable(group, details);
    this.selectableRoots.push(group);
    this.root.add(group);
    return group;
  }

  private registerFacilityObject(
    facilityId: RefugeStructureId,
    object: THREE.Object3D,
    anchorX: number,
    anchorZ: number,
    anchorRotation: number,
  ): void {
    const records = this.facilityObjects.get(facilityId) ?? [];
    records.push({
      anchorRotation,
      anchorX,
      anchorZ,
      baseRotation: object.rotation.y,
      object,
      offsetX: object.position.x - anchorX,
      offsetZ: object.position.z - anchorZ,
    });
    this.facilityObjects.set(facilityId, records);
  }

  private createBuildPreview(): void {
    const material = new THREE.MeshBasicMaterial({
      color: "#747b5d",
      depthWrite: false,
      opacity: 0.32,
      transparent: true,
    });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1, 32), material);
    const direction = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 1.3), material.clone());
    direction.position.z = -0.68;
    this.previewRoot.add(disc, direction);
    this.previewRoot.visible = false;
    this.previewRoot.renderOrder = 9;
    this.root.add(this.previewRoot);
  }

  private addConstruction(site: Readonly<ConstructionSite>): void {
    const recipe = FACILITY_RECIPES.find((entry) => entry.id === site.recipeId);
    if (!recipe) return;
    const group = new THREE.Group();
    group.position.set(site.x, 0.2, site.z);
    group.rotation.y = site.rotation;
    const complete = site.state === "Complete";
    markSelectable(group, {
      category: "facility",
      detail: complete ? `${recipe.service}. Operational.` : `${site.state} · ${site.builderIds.length} builder${site.builderIds.length === 1 ? "" : "s"} assigned.`,
      id: site.id,
      label: recipe.label,
    });
    this.selectableRoots.push(group);
    this.constructionSelectionRoots.add(group);
    if (complete) this.addCompletedFacilityGeometry(group, site.recipeId);
    else this.addSiteGeometry(group, recipe.footprintRadius, site.state === "Materials");
    placeObjectOnRefugeGround(group);
    this.constructionRoot.add(group);
  }

  private addSiteGeometry(group: THREE.Group, radius: number, materialsDelivered: boolean): void {
    const timber = new THREE.MeshStandardMaterial({ color: "#735638", roughness: 1 });
    const foundation = new THREE.MeshStandardMaterial({ color: materialsDelivered ? "#747b5d" : "#5d5a51", roughness: 1 });
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius * 0.9, 0.35, 12), foundation);
    slab.position.y = 0.18;
    slab.receiveShadow = true;
    group.add(slab);
    [-1, 1].forEach((x) => [-1, 1].forEach((z) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, materialsDelivered ? 2.8 : 1.4, 6), timber);
      post.position.set(x * radius * 0.52, materialsDelivered ? 1.4 : 0.7, z * radius * 0.52);
      post.castShadow = true;
      group.add(post);
    }));
  }

  private addCompletedFacilityGeometry(group: THREE.Group, type: FacilityRecipeId): void {
    const stone = new THREE.MeshStandardMaterial({ color: "#5d5a51", roughness: 0.94 });
    const timber = new THREE.MeshStandardMaterial({ color: "#72543a", roughness: 0.96 });
    const bronze = new THREE.MeshStandardMaterial({ color: "#a78652", metalness: 0.18, roughness: 0.78 });
    const cloth = new THREE.MeshStandardMaterial({ color: type === "infirmary" ? "#7a4545" : "#747b5d", roughness: 1 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.42, 10), stone);
    floor.position.y = 0.21;
    floor.receiveShadow = true;
    group.add(floor);
    if (type === "smithy") {
      const shelter = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.4, 4.2), stone);
      shelter.position.y = 1.9;
      shelter.castShadow = true;
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.82, 4.8, 8), timber);
      chimney.position.set(1.7, 3.8, -0.8);
      chimney.castShadow = true;
      group.add(shelter, chimney);
      return;
    }
    if (type === "training-hall") {
      [-2.2, 0, 2.2].forEach((x) => {
        const target = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.3, 12), cloth);
        target.position.set(x, 2.4, 0);
        target.rotation.x = Math.PI / 2;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.6, 6), timber);
        post.position.set(x, 1.8, 0);
        group.add(post, target);
      });
      return;
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.2, 4.5), type === "storage" ? timber : cloth);
    body.position.y = 1.8;
    body.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.5, 4), type === "dormitory" ? cloth : bronze);
    roof.position.y = 4.55;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(body, roof);
  }

  private rebuildEnvironment(layout: Readonly<RefugeLayoutSnapshot>): void {
    this.environmentSelectionRoots.forEach((root) => this.removeSelectableRoot(root));
    this.environmentSelectionRoots.clear();
    while (this.environmentRoot.children.length > 0) {
      const child = this.environmentRoot.children[0];
      if (!child) break;
      this.disposeObject(child);
    }
    if (layout.trails.length > 0) {
      const material = new THREE.MeshStandardMaterial({ color: "#756846", roughness: 1 });
      const trailRoot = new THREE.Group();
      const ids = new Set(layout.trails.map((cell) => cell.id));
      layout.trails.forEach((cell) => {
        const node = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.07, 16), material);
        node.position.set(cell.x, REFUGE_GROUND_Y + 0.035, cell.z);
        node.receiveShadow = true;
        trailRoot.add(node);
        [[2, 0], [0, 2]].forEach(([dx, dz]) => {
          if (!ids.has(`trail:${cell.x + (dx ?? 0)}:${cell.z + (dz ?? 0)}`)) return;
          const horizontal = dx !== 0;
          const segment = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 2 : 1.85, 0.07, horizontal ? 1.85 : 2), material);
          segment.position.set(cell.x + (dx ?? 0) / 2, REFUGE_GROUND_Y + 0.035, cell.z + (dz ?? 0) / 2);
          segment.receiveShadow = true;
          trailRoot.add(segment);
        });
      });
      this.environmentRoot.add(trailRoot);
    }
    layout.trees.filter((tree) => tree.placed).forEach((tree) => this.addEnvironmentTree(tree));
    layout.rocks.filter((rock) => rock.placed).forEach((rock) => this.addEnvironmentRock(rock));
  }

  private addEnvironmentTree(tree: Readonly<import("../refuge/RefugeLayoutSystem").RefugeEnvironmentPlacement>): void {
    const group = new THREE.Group();
    group.name = `Tree ${tree.id.split("-").at(-1) ?? ""}`;
    group.position.set(tree.x, 0.32, tree.z);
    group.rotation.y = tree.rotation;
    group.scale.setScalar(tree.scale);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.46, 3.5, 7), new THREE.MeshStandardMaterial({ color: "#493727", roughness: 1 }));
    trunk.position.y = 1.75;
    trunk.castShadow = true;
    group.add(trunk);
    [0, 1].forEach((tier) => {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.75 - tier * 0.35, 3.9, 7), new THREE.MeshStandardMaterial({ color: tier ? "#3f5036" : "#34452f", roughness: 1 }));
      crown.position.y = 4.3 + tier * 1.25;
      crown.castShadow = true;
      group.add(crown);
    });
    placeObjectOnRefugeGround(group);
    markSelectable(group, { category: "prop", id: tree.id, label: group.name });
    this.selectableRoots.push(group);
    this.environmentSelectionRoots.add(group);
    this.environmentRoot.add(group);
  }

  private addEnvironmentRock(rock: Readonly<import("../refuge/RefugeLayoutSystem").RefugeEnvironmentPlacement>): void {
    const group = new THREE.Group();
    group.name = `Rock ${rock.id.split("-").at(-1) ?? ""}`;
    group.position.set(rock.x, 0.3, rock.z);
    group.rotation.y = rock.rotation;
    group.scale.setScalar(rock.scale);
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), new THREE.MeshStandardMaterial({ color: "#777469", roughness: 1 }));
    mesh.position.y = 0.62;
    mesh.scale.set(1.2, 0.72, 0.92);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    placeObjectOnRefugeGround(group);
    markSelectable(group, { category: "prop", id: rock.id, label: group.name });
    this.selectableRoots.push(group);
    this.environmentSelectionRoots.add(group);
    this.environmentRoot.add(group);
  }

  private removeSelectableRoot(root: THREE.Object3D): void {
    const index = this.selectableRoots.indexOf(root);
    if (index >= 0) {
      this.selectableRoots.splice(index, 1);
    }
  }

  private disposeObject(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) {
        return;
      }
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    root.removeFromParent();
  }
}
