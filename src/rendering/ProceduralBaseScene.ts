import * as THREE from "three";

import { markSelectable, type SelectionDetails } from "./SelectionRaycaster";
import type { FallenHeroRecord } from "../heroes/Hero";

type FacilityColor = "#49758a" | "#926d3f" | "#56765e" | "#755b8c";

export class ProceduralBaseScene {
  private readonly memorialRoots = new Map<string, THREE.Group>();

  private readonly fireGlow = new THREE.PointLight("#ff8a45", 54, 27, 2);
  private readonly flameCore: THREE.Mesh;
  private readonly root = new THREE.Group();

  constructor(
    private readonly scene: THREE.Scene,
    readonly selectableRoots: THREE.Object3D[] = [],
  ) {
    this.root.name = "Procedural Refuge";
    this.scene.background = new THREE.Color("#111820");
    this.scene.fog = new THREE.Fog("#111820", 66, 144);

    this.addLighting();
    this.addGround();
    this.addFacilityZone("dormitory-zone", "Dormitory Zone", "#49758a", -17.1, -13.2);
    this.addFacilityZone("training-zone", "Training Zone", "#926d3f", 16.2, -13.5);
    this.addFacilityZone("storage-zone", "Storage Zone", "#56765e", -16.2, 13.5);
    this.addFacilityZone("gate-zone", "Gate Zone", "#755b8c", 16.8, 12.9);

    this.flameCore = this.addCampfire();
    this.addTent();
    this.addInfirmary();
    this.addTrainingDummy();
    this.addCrates();
    this.addStoragePile();
    this.addGatePlaceholder();
    this.scene.add(this.root);
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
      root.position.set(-5.2 + column * 2.55, 0.34, 20.2 + row * 2.4);
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

  private addGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(162, 162),
      new THREE.MeshStandardMaterial({ color: "#1b211f", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.24;
    ground.receiveShadow = true;
    this.root.add(ground);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(34.5, 36, 1.26, 12),
      new THREE.MeshStandardMaterial({ color: "#343c3c", roughness: 0.92 }),
    );
    platform.position.y = -0.02;
    platform.receiveShadow = true;
    this.root.add(platform);

    const innerPlatform = new THREE.Mesh(
      new THREE.CylinderGeometry(32.1, 32.1, 0.24, 12),
      new THREE.MeshStandardMaterial({ color: "#404948", roughness: 0.96 }),
    );
    innerPlatform.position.y = 0.22;
    innerPlatform.receiveShadow = true;
    this.root.add(innerPlatform);

    const grid = new THREE.GridHelper(63, 63, "#6f8583", "#53605f");
    grid.position.y = 0.27;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.24;
    });
    this.root.add(grid);
  }

  private addFacilityZone(
    id: string,
    label: string,
    color: FacilityColor,
    x: number,
    z: number,
  ): void {
    const group = new THREE.Group();
    group.name = label;
    group.position.set(x, 0.28, z);

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(7.05, 7.05, 0.21, 32),
      new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.38,
        roughness: 0.8,
        depthWrite: false,
      }),
    );
    pad.receiveShadow = true;
    group.add(pad);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6.3, 0.135, 6, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.07;
    group.add(ring);

    markSelectable(group, { category: "facility", id, label });
    this.selectableRoots.push(group);
    this.root.add(group);
  }

  private addCampfire(): THREE.Mesh {
    const group = this.createSelectableGroup({ category: "prop", id: "campfire", label: "Campfire" });
    group.position.set(0, 1.08, 0);

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
    return flameCore;
  }

  private addInfirmary(): void {
    const group = this.createSelectableGroup({
      category: "facility",
      detail: "Injured heroes recover here while resting. Treatment requires Medicine.",
      id: "infirmary",
      label: "Refuge Infirmary",
    });
    group.position.set(-10.4, 0.38, -16.8);
    group.rotation.y = -0.16;
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
    const group = this.createSelectableGroup({ category: "prop", id: "basic-tent", label: "Basic Tent" });
    group.position.set(-17.1, 1.08, -13.2);

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
  }

  private addTrainingDummy(): void {
    const group = this.createSelectableGroup({ category: "prop", id: "training-dummy", label: "Training Dummy" });
    group.position.set(16.2, 1.02, -13.5);
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
  }

  private addCrates(): void {
    const group = this.createSelectableGroup({ category: "prop", id: "supply-crates", label: "Supply Crates" });
    group.position.set(-18.3, 0.99, 12.75);
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
  }

  private addStoragePile(): void {
    const group = this.createSelectableGroup({ category: "prop", id: "storage-pile", label: "Storage Pile" });
    group.position.set(-13.05, 1.14, 15.75);
    const sackMaterial = new THREE.MeshStandardMaterial({ color: "#8a8068", roughness: 1 });
    for (let index = 0; index < 5; index += 1) {
      const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(1.44, 1), sackMaterial);
      sack.position.set((index % 3) * 1.65, index > 2 ? 2.16 : 0.84, Math.sin(index) * 0.6);
      sack.scale.set(1, 0.62, 0.72);
      sack.castShadow = true;
      group.add(sack);
    }
  }

  private addGatePlaceholder(): void {
    const group = this.createSelectableGroup({ category: "base", id: "dimensional-gate", label: "Gate Foundation" });
    group.position.set(16.8, 1.08, 12.9);
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
  }

  private createSelectableGroup(details: SelectionDetails): THREE.Group {
    const group = new THREE.Group();
    group.name = details.label;
    markSelectable(group, details);
    this.selectableRoots.push(group);
    this.root.add(group);
    return group;
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
