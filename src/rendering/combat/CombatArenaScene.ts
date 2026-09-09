import * as THREE from "three";

import type { CombatSnapshot, CombatantSnapshot } from "../../combat/Combat";

interface RenderedCombatant {
  body: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  defendRing: THREE.Mesh;
  healthFill: THREE.Mesh;
  healthRoot: THREE.Group;
  root: THREE.Group;
}

export class CombatArenaScene {
  private readonly combatants = new Map<string, RenderedCombatant>();
  private readonly root = new THREE.Group();

  constructor(private readonly scene: THREE.Scene) {
    this.scene.background = new THREE.Color("#090d12");
    this.scene.fog = new THREE.Fog("#090d12", 48, 92);
    this.root.name = "Combat Sandbox Arena";
    this.addLighting();
    this.addArena();
    this.scene.add(this.root);
  }

  update(snapshot: Readonly<CombatSnapshot>, timestampSeconds: number, camera: THREE.Camera): void {
    const currentIds = new Set(snapshot.combatants.map((combatant) => combatant.id));
    this.combatants.forEach((rendered, id) => {
      if (!currentIds.has(id)) {
        this.disposeRenderedCombatant(rendered);
        this.combatants.delete(id);
      }
    });
    snapshot.combatants.forEach((combatant, index) => {
      let rendered = this.combatants.get(combatant.id);
      if (!rendered) {
        rendered = this.createCombatant(combatant, index);
        this.combatants.set(combatant.id, rendered);
        this.root.add(rendered.root);
      }
      this.updateCombatant(rendered, combatant, timestampSeconds, camera);
    });
  }

  dispose(): void {
    this.combatants.forEach((rendered) => this.disposeRenderedCombatant(rendered));
    this.combatants.clear();
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
    this.root.add(new THREE.HemisphereLight("#b9e4ed", "#211b1a", 1.7));
    const key = new THREE.DirectionalLight("#ffd8b0", 3.4);
    key.position.set(-20, 32, 18);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -24;
    key.shadow.camera.right = 24;
    key.shadow.camera.top = 24;
    key.shadow.camera.bottom = -24;
    this.root.add(key);
  }

  private addArena(): void {
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(19, 20, 0.8, 32),
      new THREE.MeshStandardMaterial({ color: "#252d2d", roughness: 0.96 }),
    );
    ground.position.y = -0.35;
    ground.receiveShadow = true;
    this.root.add(ground);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(18.25, 0.18, 8, 96),
      new THREE.MeshBasicMaterial({ color: "#5f98a1", transparent: true, opacity: 0.58 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    this.root.add(ring);

    const centerLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 30),
      new THREE.MeshBasicMaterial({ color: "#688084", transparent: true, opacity: 0.26 }),
    );
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.y = 0.08;
    this.root.add(centerLine);

    const grid = new THREE.GridHelper(34, 17, "#52696d", "#39484a");
    grid.position.y = 0.07;
    const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.32;
    });
    this.root.add(grid);

    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.62, 3.2, 6),
        new THREE.MeshStandardMaterial({ color: "#3d5155", emissive: "#17343a", emissiveIntensity: 0.7 }),
      );
      pylon.position.set(Math.cos(angle) * 18.2, 1.5, Math.sin(angle) * 18.2);
      pylon.castShadow = true;
      this.root.add(pylon);
    }
  }

  private createCombatant(combatant: Readonly<CombatantSnapshot>, index: number): RenderedCombatant {
    const root = new THREE.Group();
    root.name = combatant.label;
    const heroColor = combatant.role === "Vanguard" ? "#598b98" : combatant.role === "Support" ? "#5d927b" : "#a77b49";
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: combatant.team === "Hero" ? heroColor : "#8e493f",
      emissive: combatant.team === "Hero" ? "#102b31" : "#36130f",
      emissiveIntensity: 0.35,
      roughness: 0.76,
    });
    const body = new THREE.Mesh(
      combatant.team === "Hero"
        ? new THREE.CapsuleGeometry(0.52, 1.05, 4, 8)
        : new THREE.ConeGeometry(0.78, 1.9, 5),
      bodyMaterial,
    );
    body.position.y = 1.15;
    body.castShadow = true;
    root.add(body);

    const head = new THREE.Mesh(
      combatant.team === "Hero"
        ? new THREE.SphereGeometry(0.43, 10, 8)
        : new THREE.IcosahedronGeometry(0.48, 0),
      new THREE.MeshStandardMaterial({
        color: combatant.team === "Hero" ? "#c28b68" : "#d06b54",
        roughness: 0.8,
      }),
    );
    head.position.y = 2.15;
    head.castShadow = true;
    root.add(head);

    const defendRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.94, 0.08, 6, 24),
      new THREE.MeshBasicMaterial({ color: "#8ed3de", transparent: true, opacity: 0.78 }),
    );
    defendRing.rotation.x = Math.PI / 2;
    defendRing.position.y = 0.13;
    defendRing.visible = false;
    root.add(defendRing);

    const healthRoot = new THREE.Group();
    healthRoot.position.y = 2.95;
    const healthBack = new THREE.Mesh(
      new THREE.PlaneGeometry(1.65, 0.16),
      new THREE.MeshBasicMaterial({ color: "#111518", transparent: true, opacity: 0.88 }),
    );
    const healthFill = new THREE.Mesh(
      new THREE.PlaneGeometry(1.55, 0.1),
      new THREE.MeshBasicMaterial({ color: combatant.team === "Hero" ? "#76c3a6" : "#d16758" }),
    );
    healthFill.position.z = 0.01;
    healthRoot.add(healthBack, healthFill);
    root.add(healthRoot);

    root.position.set(combatant.position.x, 0.12, combatant.position.z);
    root.userData.phase = index * 0.9;
    return { body, defendRing, healthFill, healthRoot, root };
  }

  private updateCombatant(
    rendered: RenderedCombatant,
    combatant: Readonly<CombatantSnapshot>,
    timestampSeconds: number,
    camera: THREE.Camera,
  ): void {
    rendered.root.position.x = THREE.MathUtils.lerp(rendered.root.position.x, combatant.position.x, 0.32);
    rendered.root.position.z = THREE.MathUtils.lerp(rendered.root.position.z, combatant.position.z, 0.32);
    rendered.root.rotation.y = combatant.team === "Hero" ? Math.PI / 2 : -Math.PI / 2;
    rendered.defendRing.visible = combatant.defending && combatant.hp > 0;
    rendered.defendRing.rotation.z = timestampSeconds * 1.8;
    rendered.healthRoot.lookAt(camera.position);

    const healthRatio = Math.max(0, combatant.hp / combatant.stats.maxHp);
    rendered.healthFill.scale.x = healthRatio;
    rendered.healthFill.position.x = -(1 - healthRatio) * 0.775;
    rendered.healthRoot.visible = combatant.hp > 0 && combatant.position.x > -14.8;

    const pulse = combatant.action === "Attack" || combatant.action === "Heal"
      ? 1 + Math.sin(timestampSeconds * 18) * 0.07
      : 1;
    rendered.body.scale.set(pulse, 1, pulse);
    if (combatant.hp <= 0) {
      rendered.root.rotation.z = THREE.MathUtils.lerp(rendered.root.rotation.z, Math.PI / 2, 0.16);
      rendered.root.position.y = 0.28;
    } else {
      rendered.root.rotation.z = 0;
      const isMoving = combatant.action === "Move" || combatant.action === "Reposition" || combatant.action === "Protect" || combatant.action === "Heal";
      rendered.root.position.y = isMoving
        ? 0.12 + Math.abs(Math.sin(timestampSeconds * 9 + Number(rendered.root.userData.phase))) * 0.08
        : 0.12;
    }
    rendered.root.visible = !(combatant.action === "Retreat" && combatant.position.x <= -14.8);
  }

  private disposeRenderedCombatant(rendered: RenderedCombatant): void {
    rendered.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    rendered.root.removeFromParent();
  }
}
