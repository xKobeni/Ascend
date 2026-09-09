import * as THREE from "three";

import { markSelectable, type SelectionDetails } from "./SelectionRaycaster";

type FacilityColor = "#49758a" | "#926d3f" | "#56765e" | "#755b8c";

export class ProceduralBaseScene {
  readonly selectableRoots: THREE.Object3D[] = [];

  private readonly fireGlow = new THREE.PointLight("#ff8a45", 18, 9, 2);
  private readonly flameCore: THREE.Mesh;
  private readonly root = new THREE.Group();

  constructor(private readonly scene: THREE.Scene) {
    this.root.name = "Procedural Refuge";
    this.scene.background = new THREE.Color("#111820");
    this.scene.fog = new THREE.Fog("#111820", 22, 48);

    this.addLighting();
    this.addGround();
    this.addFacilityZone("dormitory-zone", "Dormitory Zone", "#49758a", -5.7, -4.4);
    this.addFacilityZone("training-zone", "Training Zone", "#926d3f", 5.4, -4.5);
    this.addFacilityZone("storage-zone", "Storage Zone", "#56765e", -5.4, 4.5);
    this.addFacilityZone("gate-zone", "Gate Zone", "#755b8c", 5.6, 4.3);

    this.flameCore = this.addCampfire();
    this.addTent();
    this.addTrainingDummy();
    this.addCrates();
    this.addStoragePile();
    this.addGatePlaceholder();
    this.scene.add(this.root);
  }

  update(timestampSeconds: number): void {
    const flicker = 1 + Math.sin(timestampSeconds * 9.5) * 0.07 + Math.sin(timestampSeconds * 15.2) * 0.04;
    this.flameCore.scale.set(flicker, 0.95 + flicker * 0.08, flicker);
    this.fireGlow.intensity = 17 + Math.sin(timestampSeconds * 11) * 2.2;
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
    sun.position.set(-10, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 45;
    sun.shadow.bias = -0.0004;
    this.root.add(sun);
  }

  private addGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(54, 54),
      new THREE.MeshStandardMaterial({ color: "#1b211f", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.24;
    ground.receiveShadow = true;
    this.root.add(ground);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(11.5, 12, 0.42, 12),
      new THREE.MeshStandardMaterial({ color: "#343c3c", roughness: 0.92 }),
    );
    platform.position.y = -0.02;
    platform.receiveShadow = true;
    this.root.add(platform);

    const innerPlatform = new THREE.Mesh(
      new THREE.CylinderGeometry(10.7, 10.7, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: "#404948", roughness: 0.96 }),
    );
    innerPlatform.position.y = 0.22;
    innerPlatform.receiveShadow = true;
    this.root.add(innerPlatform);

    const grid = new THREE.GridHelper(21, 21, "#6f8583", "#53605f");
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
      new THREE.CylinderGeometry(2.35, 2.35, 0.07, 32),
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
      new THREE.TorusGeometry(2.1, 0.045, 6, 48),
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
    group.position.set(0, 0.36, 0);

    const stoneMaterial = new THREE.MeshStandardMaterial({ color: "#55534d", roughness: 1 });
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneMaterial);
      stone.position.set(Math.cos(angle) * 0.78, 0.18, Math.sin(angle) * 0.78);
      stone.scale.set(1.2, 0.72, 0.9);
      stone.castShadow = true;
      group.add(stone);
    }

    const logMaterial = new THREE.MeshStandardMaterial({ color: "#4d2f21", roughness: 1 });
    for (const rotation of [-0.72, 0.72]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 1.15, 8), logMaterial);
      log.rotation.set(Math.PI / 2, 0, rotation);
      log.position.y = 0.3;
      log.castShadow = true;
      group.add(log);
    }

    const outerFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 1.25, 7),
      new THREE.MeshStandardMaterial({ color: "#f0783d", emissive: "#9b2f15", emissiveIntensity: 1.8 }),
    );
    outerFlame.position.y = 1.02;
    group.add(outerFlame);

    const flameCore = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 0.76, 7),
      new THREE.MeshBasicMaterial({ color: "#ffd56a" }),
    );
    flameCore.position.y = 0.87;
    group.add(flameCore);

    this.fireGlow.position.y = 1.55;
    group.add(this.fireGlow);
    return flameCore;
  }

  private addTent(): void {
    const group = this.createSelectableGroup({ category: "prop", id: "basic-tent", label: "Basic Tent" });
    group.position.set(-5.7, 0.36, -4.4);

    const fabric = new THREE.MeshStandardMaterial({ color: "#73878a", roughness: 0.95, side: THREE.DoubleSide });
    const shelter = new THREE.Mesh(new THREE.ConeGeometry(1.55, 2.45, 4), fabric);
    shelter.position.y = 1.2;
    shelter.rotation.y = Math.PI / 4;
    shelter.castShadow = true;
    shelter.receiveShadow = true;
    group.add(shelter);

    const opening = new THREE.Mesh(
      new THREE.CircleGeometry(0.47, 3),
      new THREE.MeshBasicMaterial({ color: "#182124", side: THREE.DoubleSide }),
    );
    opening.position.set(0, 0.92, 1.24);
    opening.rotation.y = Math.PI;
    group.add(opening);
  }

  private addTrainingDummy(): void {
    const group = this.createSelectableGroup({ category: "prop", id: "training-dummy", label: "Training Dummy" });
    group.position.set(5.4, 0.34, -4.5);
    const wood = new THREE.MeshStandardMaterial({ color: "#8b6540", roughness: 0.9 });
    const bindings = new THREE.MeshStandardMaterial({ color: "#8d4f3f", roughness: 0.85 });

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 2.5, 8), wood);
    post.position.y = 1.22;
    post.castShadow = true;
    group.add(post);

    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.7, 8), wood);
    crossbar.position.y = 1.62;
    crossbar.rotation.z = Math.PI / 2;
    crossbar.castShadow = true;
    group.add(crossbar);

    const target = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.24, 16), bindings);
    target.position.set(0, 1.63, 0.14);
    target.rotation.x = Math.PI / 2;
    target.castShadow = true;
    group.add(target);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), wood);
    head.position.y = 2.3;
    head.castShadow = true;
    group.add(head);
  }

  private addCrates(): void {
    const group = this.createSelectableGroup({ category: "prop", id: "supply-crates", label: "Supply Crates" });
    group.position.set(-6.1, 0.33, 4.25);
    const wood = new THREE.MeshStandardMaterial({ color: "#735638", roughness: 0.9 });
    const slat = new THREE.MeshStandardMaterial({ color: "#4e3a29", roughness: 1 });
    const layouts = [
      { x: -0.55, y: 0.48, z: 0.1, size: 0.95 },
      { x: 0.48, y: 0.4, z: 0.36, size: 0.8 },
      { x: 0.05, y: 1.12, z: -0.12, size: 0.7 },
    ];
    layouts.forEach(({ x, y, z, size }) => {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), wood);
      crate.position.set(x, y, z);
      crate.rotation.y = x * 0.18;
      crate.castShadow = true;
      crate.receiveShadow = true;
      group.add(crate);
      const band = new THREE.Mesh(new THREE.BoxGeometry(size + 0.025, size * 0.12, size + 0.03), slat);
      band.position.set(x, y, z);
      band.rotation.y = crate.rotation.y;
      group.add(band);
    });
  }

  private addStoragePile(): void {
    const group = this.createSelectableGroup({ category: "prop", id: "storage-pile", label: "Storage Pile" });
    group.position.set(-4.35, 0.38, 5.25);
    const sackMaterial = new THREE.MeshStandardMaterial({ color: "#8a8068", roughness: 1 });
    for (let index = 0; index < 5; index += 1) {
      const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 1), sackMaterial);
      sack.position.set((index % 3) * 0.55, index > 2 ? 0.72 : 0.28, Math.sin(index) * 0.2);
      sack.scale.set(1, 0.62, 0.72);
      sack.castShadow = true;
      group.add(sack);
    }
  }

  private addGatePlaceholder(): void {
    const group = this.createSelectableGroup({ category: "base", id: "dimensional-gate", label: "Gate Foundation" });
    group.position.set(5.6, 0.36, 4.3);
    const stone = new THREE.MeshStandardMaterial({ color: "#555361", roughness: 0.72, metalness: 0.1 });
    for (const x of [-0.95, 0.95]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.8, 0.65), stone);
      pillar.position.set(x, 1.38, 0);
      pillar.rotation.z = -x * 0.06;
      pillar.castShadow = true;
      group.add(pillar);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.48, 0.68), stone);
    lintel.position.y = 2.78;
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
}
