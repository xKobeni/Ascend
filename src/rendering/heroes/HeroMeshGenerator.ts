import * as THREE from "three";

import type { HairLength, HairStyle, Hero } from "../../heroes/Hero";

export interface HeroRig {
  body: THREE.Mesh;
  footLeft: THREE.Mesh;
  footRight: THREE.Mesh;
  handLeft: THREE.Mesh;
  handRight: THREE.Mesh;
  head: THREE.Mesh;
  hair: THREE.Object3D[];
  legLeft: THREE.Mesh;
  legRight: THREE.Mesh;
  armLeft: THREE.Mesh;
  armRight: THREE.Mesh;
  root: THREE.Group;
}

function createCapsule(radius: number, height: number, capSegments = 8, radialSegments = 12): THREE.BufferGeometry {
  const geometry = new THREE.CapsuleGeometry(radius, height, capSegments, radialSegments);
  return geometry;
}

export class HeroMeshGenerator {
  create(hero: Readonly<Hero>): HeroRig {
    const group = new THREE.Group();
    group.name = hero.name;

    const { gender } = hero.appearance;
    const isFemale = gender === "female";
    const bodyW = hero.appearance.bodyWidth;

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: hero.appearance.clothingColor,
      roughness: 0.85,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: hero.appearance.skinTone,
      roughness: 0.82,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: hero.appearance.hairColor,
      roughness: 0.9,
    });
    const legMat = new THREE.MeshStandardMaterial({
      color: "#2d3438",
      roughness: 0.95,
    });

    // Body - capsule shape
    const bodyRadius = isFemale ? 0.32 * bodyW : 0.35 * bodyW;
    const bodyHeight = isFemale ? 0.5 : 0.55;
    const body = new THREE.Mesh(createCapsule(bodyRadius, bodyHeight, 8, 12), bodyMat);
    body.position.y = 1.15;
    group.add(body);

    // Head - simple sphere
    const headRadius = (isFemale ? 0.26 : 0.28) * hero.appearance.headScale;
    const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 12, 10), skinMat);
    head.position.y = 1.95;
    group.add(head);

    // Hair - simplified
    const hairPieces = this.addHair(
      group,
      hero.appearance.hairStyle,
      hero.appearance.hairLength,
      hero.appearance.headScale,
      hairMat,
    );

    // Arms - short stubby cylinders
    const shoulderOffset = (isFemale ? 0.38 : 0.42) * hero.appearance.shoulderWidth;
    const armRadius = 0.07;
    const armLength = 0.32 * hero.appearance.armLength;

    const armLeft = new THREE.Mesh(
      new THREE.CylinderGeometry(armRadius, armRadius * 0.9, armLength, 8),
      bodyMat,
    );
    armLeft.position.set(-shoulderOffset * bodyW, 1.28, 0);
    armLeft.rotation.z = 0.15;
    group.add(armLeft);

    // Left hand as child of left arm
    const handRadius = 0.08;
    const handLeft = new THREE.Mesh(new THREE.SphereGeometry(handRadius, 8, 6), skinMat);
    handLeft.position.set(0, -armLength / 2 - handRadius * 0.8, 0);
    armLeft.add(handLeft);

    const armRight = new THREE.Mesh(
      new THREE.CylinderGeometry(armRadius, armRadius * 0.9, armLength, 8),
      bodyMat,
    );
    armRight.position.set(shoulderOffset * bodyW, 1.28, 0);
    armRight.rotation.z = -0.15;
    group.add(armRight);

    // Right hand as child of right arm
    const handRight = new THREE.Mesh(new THREE.SphereGeometry(handRadius, 8, 6), skinMat);
    handRight.position.set(0, -armLength / 2 - handRadius * 0.8, 0);
    armRight.add(handRight);

    // Legs - short stubby cylinders
    const hipSpread = isFemale ? 0.18 : 0.16;
    const legRadius = 0.09;
    const legLength = 0.28 * hero.appearance.legLength;

    const legLeft = new THREE.Mesh(
      new THREE.CylinderGeometry(legRadius, legRadius * 0.85, legLength, 8),
      legMat,
    );
    legLeft.position.set(-hipSpread * bodyW, 0.74 - legLength / 2, 0);
    group.add(legLeft);

    // Left foot as child of left leg
    const footRadius = 0.1;
    const footLeft = new THREE.Mesh(new THREE.SphereGeometry(footRadius, 8, 6), legMat);
    footLeft.position.set(0, -legLength / 2 - footRadius * 0.7, 0.04);
    legLeft.add(footLeft);

    const legRight = new THREE.Mesh(
      new THREE.CylinderGeometry(legRadius, legRadius * 0.85, legLength, 8),
      legMat,
    );
    legRight.position.set(hipSpread * bodyW, 0.74 - legLength / 2, 0);
    group.add(legRight);

    // Right foot as child of right leg
    const footRight = new THREE.Mesh(new THREE.SphereGeometry(footRadius, 8, 6), legMat);
    footRight.position.set(0, -legLength / 2 - footRadius * 0.7, 0.04);
    legRight.add(footRight);

    // Scale and shadows
    group.scale.setScalar(hero.appearance.height);
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    return {
      armLeft,
      armRight,
      body,
      footLeft,
      footRight,
      handLeft,
      handRight,
      head,
      hair: hairPieces,
      legLeft,
      legRight,
      root: group,
    };
  }

  private addHair(
    group: THREE.Group,
    style: HairStyle,
    length: HairLength,
    headScale: number,
    material: THREE.Material,
  ): THREE.Object3D[] {
    const pieces: THREE.Object3D[] = [];
    if (style === "bald") {
      return pieces;
    }

    // Hair cap - hemisphere on top of head
    const capRadius = 0.29 * headScale;
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(capRadius, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      material,
    );
    cap.position.y = 1.95 + 0.05 * headScale;
    group.add(cap);
    pieces.push(cap);

    // Simple style additions
    if (style === "long" && length === "long") {
      // Long hair - simple hanging cylinders
      const strandLength = 0.5;
      const leftStrand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.04, strandLength, 6),
        material,
      );
      leftStrand.position.set(-0.2 * headScale, 1.7, -0.1);
      group.add(leftStrand);
      pieces.push(leftStrand);

      const rightStrand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.04, strandLength, 6),
        material,
      );
      rightStrand.position.set(0.2 * headScale, 1.7, -0.1);
      group.add(rightStrand);
      pieces.push(rightStrand);
    } else if (style === "ponytail") {
      const tailLength = length === "long" ? 0.4 : 0.25;
      const tail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.03, tailLength, 6),
        material,
      );
      tail.position.set(0, 1.7, -0.2);
      tail.rotation.x = 0.4;
      group.add(tail);
      pieces.push(tail);
    } else if (style === "bun") {
      const bunSize = length === "long" ? 0.14 : 0.11;
      const bun = new THREE.Mesh(new THREE.SphereGeometry(bunSize, 8, 6), material);
      bun.position.set(0, 1.95 + 0.2 * headScale, -0.18 * headScale);
      group.add(bun);
      pieces.push(bun);
    } else if (style === "mohawk") {
      const crest = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.2, 0.35),
        material,
      );
      crest.position.set(0, 1.95 + 0.25 * headScale, 0);
      group.add(crest);
      pieces.push(crest);
    } else if (style === "wild") {
      for (let i = 0; i < 4; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 5), material);
        const angle = (i / 4) * Math.PI * 1.2 - Math.PI * 0.6;
        spike.position.set(
          Math.sin(angle) * 0.18,
          2.18 + Math.cos(angle) * 0.04,
          Math.cos(angle) * 0.12,
        );
        spike.rotation.z = Math.sin(angle) * 0.4;
        group.add(spike);
        pieces.push(spike);
      }
    } else if (style === "curly") {
      for (let i = 0; i < 6; i++) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), material);
        const angle = (i / 6) * Math.PI * 2;
        curl.position.set(
          Math.cos(angle) * 0.22,
          2.05 + Math.sin(i * 0.8) * 0.06,
          Math.sin(angle) * 0.15,
        );
        group.add(curl);
        pieces.push(curl);
      }
    }
    // short, cropped, slicked, swept, braided - just the cap

    return pieces;
  }
}
