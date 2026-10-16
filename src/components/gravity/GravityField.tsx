"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Exact port of the senior's gravity-field scene (Three.js). */
export default function GravityField() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    const theme = getComputedStyle(host);
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = colorCanvas.height = 1;
    const colorContext = colorCanvas.getContext("2d");
    const token = (name: string) => {
      if (!colorContext) return new THREE.Color();
      colorContext.fillStyle = theme.getPropertyValue(name).trim();
      colorContext.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0] = colorContext.getImageData(0, 0, 1, 1).data;
      return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    };
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearAlpha(0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(8.5, 10.5, 12.5);
    camera.zoom = 1.55;
    camera.lookAt(0, -0.4, 0);
    const field = new THREE.Group();
    field.rotation.y = -0.23;
    scene.add(field);
    const half = 12;
    const count = 88;
    const samples = 100;
    const lines: THREE.Line[] = [];
    for (let axis = 0; axis < 2; axis++) {
      for (let i = 0; i <= count; i++) {
        const position = new Float32Array((samples + 1) * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
        const edge = i === 0 || i === count;
        const material = new THREE.LineBasicMaterial({
          color: token(edge ? "--field-edge" : "--field-line"),
          transparent: true,
          opacity: edge ? 0.3 : i % 4 === 0 ? 0.34 : 0.2,
        });
        const line = new THREE.Line(geometry, material);
        line.userData = { axis, fixed: -half + (i / count) * half * 2 };
        field.add(line);
        lines.push(line);
      }
    }
    // A studio reflection map gives the moving sphere crisp, continuous highlights.
    const reflection = document.createElement("canvas");
    reflection.width = 1024;
    reflection.height = 512;
    const ctx = reflection.getContext("2d");
    if (ctx) {
      ctx.fillStyle = theme.getPropertyValue("--sphere-environment").trim();
      ctx.fillRect(0, 0, 1024, 512);
      ctx.fillStyle = theme.getPropertyValue("--sphere-highlight").trim();
      ctx.fillRect(170, 85, 210, 80);
      ctx.fillRect(740, 120, 32, 260);
      ctx.fillStyle = theme.getPropertyValue("--sphere-reflection").trim();
      ctx.fillRect(450, 280, 180, 80);
    }
    const env = new THREE.CanvasTexture(reflection);
    env.mapping = THREE.EquirectangularReflectionMapping;
    env.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromEquirectangular(env);
    scene.environment = environment.texture;
    const ballGeometry = new THREE.SphereGeometry(0.48, 64, 48);
    const ballMaterial = new THREE.MeshPhysicalMaterial({
      color: token("--sphere-body"),
      metalness: 0.92,
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    field.add(ball);
    scene.add(new THREE.HemisphereLight(token("--sphere-highlight"), token("--sphere-body"), 2));
    const light = new THREE.DirectionalLight(token("--sphere-highlight"), 4);
    light.position.set(-3, 8, 4);
    scene.add(light);
    const resize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      if (host.clientWidth <= 700) {
        camera.lookAt(2, -0.4, -1);
        camera.setViewOffset(
          host.clientWidth,
          host.clientHeight,
          0,
          -host.clientHeight * 0.15,
          host.clientWidth,
          host.clientHeight,
        );
      } else {
        camera.lookAt(0, -0.4, 0);
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = new THREE.Vector2();
    const move = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      pointer.set(
        (event.clientX - bounds.left) / bounds.width - 0.5,
        (event.clientY - bounds.top) / bounds.height - 0.5,
      );
    };
    const leave = () => pointer.set(0, 0);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);
    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const t = reduceMotion ? 0.7 : (now - start) * 0.00016 + 0.7;
      const bx = 2.5 + Math.cos(t) * 1.35;
      const bz = -1.7 + Math.sin(t) * 1.1;
      const height = (x: number, z: number) => {
        const d = (x - bx) ** 2 + (z - bz) ** 2;
        const boundary = (1 - (x / half) ** 8) * (1 - (z / half) ** 8);
        return -1.24 * Math.exp(-d / 1.65) * Math.max(0, boundary);
      };
      for (const line of lines) {
        const points = line.geometry.getAttribute("position") as THREE.BufferAttribute;
        const { axis, fixed } = line.userData;
        for (let j = 0; j <= samples; j++) {
          const variable = -half + (j / samples) * half * 2;
          const x = axis === 0 ? fixed : variable;
          const z = axis === 0 ? variable : fixed;
          points.setXYZ(j, x, height(x, z), z);
        }
        points.needsUpdate = true;
      }
      ball.position.set(bx, height(bx, bz) + 0.48, bz);
      ball.rotation.set(t * 0.6, t, t * 0.2);
      if (!reduceMotion) {
        field.rotation.y += (-0.23 + pointer.x * 0.18 - field.rotation.y) * 0.025;
        field.rotation.x += (pointer.y * 0.06 - field.rotation.x) * 0.025;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      lines.forEach((line) => {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });
      ballGeometry.dispose();
      ballMaterial.dispose();
      env.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={container}
      className="gravity-field"
      role="img"
      aria-label="A polished black sphere orbits a fine diagonal spacetime grid, curving the sheet beneath it."
    />
  );
}
