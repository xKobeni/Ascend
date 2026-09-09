import * as THREE from "three";

import type { HairStyle, Hero } from "../../heroes/Hero";

export class HeroMeshGenerator {
  create(hero: Readonly<Hero>): THREE.Group {
    const group = new THREE.Group();
    group.name = hero.name;

    const skin = new THREE.MeshStandardMaterial({ color: hero.appearance.skinTone, roughness: 0.82 });
    const clothing = new THREE.MeshStandardMaterial({ color: hero.appearance.clothingColor, roughness: 0.88 });
    const trousers = new THREE.MeshStandardMaterial({ color: "#2d3438", roughness: 0.95 });
    const hair = new THREE.MeshStandardMaterial({ color: hero.appearance.hairColor, roughness: 0.92 });
    const boots = new THREE.MeshStandardMaterial({ color: "#272422", roughness: 1 });

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.78 * hero.appearance.bodyWidth, 1.0, 0.42),
      clothing,
    );
    torso.position.y = 1.42;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 10, 8), skin);
    head.position.y = 2.18;
    group.add(head);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 5), skin);
    nose.position.set(0, 2.14, 0.31);
    nose.rotation.x = Math.PI / 2;
    group.add(nose);

    this.addHair(group, hero.appearance.hairStyle, hair);

    for (const x of [-0.23, 0.23]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.82, 7), trousers);
      leg.position.set(x * hero.appearance.bodyWidth, 0.58, 0);
      group.add(leg);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.38), boots);
      boot.position.set(x * hero.appearance.bodyWidth, 0.13, 0.07);
      group.add(boot);
    }

    for (const x of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.105, 0.88, 7), clothing);
      arm.position.set(x * (0.5 * hero.appearance.bodyWidth), 1.38, 0);
      arm.rotation.z = x * -0.09;
      group.add(arm);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), skin);
      hand.position.set(x * (0.54 * hero.appearance.bodyWidth), 0.93, 0);
      group.add(hand);
    }

    group.scale.setScalar(hero.appearance.height);
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return group;
  }

  private addHair(group: THREE.Group, style: HairStyle, material: THREE.Material): void {
    if (style === "bald") {
      return;
    }

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.322, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      material,
    );
    cap.position.y = 2.23;
    group.add(cap);

    if (style === "bun") {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), material);
      bun.position.set(0, 2.38, -0.25);
      group.add(bun);
    } else if (style === "mohawk") {
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.5), material);
      crest.position.set(0, 2.52, -0.02);
      crest.rotation.x = -0.12;
      group.add(crest);
    } else if (style === "swept") {
      const sweep = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.12, 0.3), material);
      sweep.position.set(0.13, 2.46, 0.01);
      sweep.rotation.z = -0.28;
      group.add(sweep);
    }
  }
}
