/**
 * 1 年をらせんで見る 3D の本体。0051
 * three.js を直に使う。`SpiralPage` から動的 import されたときだけ、この中身が読み込まれる。
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { spiralPoint } from "./geometry";
import { pochiProgress } from "./pochi";
import type { DaySummary } from "./summarize";
import { REDUCED_MOTION_QUERY } from "./support";

const RADIUS = 3.2;
const HEIGHT = 7;
const DOT_RADIUS = 0.09;
const PHOTO_SIZE = 0.34;
const TARGET_FPS = 24;
const MIN_DISTANCE = 4;
const MAX_DISTANCE = 16;
const ROTATE_SPEED = 0.008;
const TAP_MOVE_LIMIT = 6;
const TAP_TIME_LIMIT = 450;

/** ぽつの球の半径 */
const POCHI_RADIUS = 0.16;

/** 今日の日まで転がる、インクのしずくの「ぽつ」。今日がその年に無ければ null。0075、F-42 */
export type PochiTarget = { index: number; total: number; color: string };

/** ラボで「ぽつを転がす」を入れているか。開くたびに読み直す。0039 */
function pochiEnabled(): boolean {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-lab-spiral-pochi");
}

/** 色の名前から、テーマに合わせた 16 進の色を読む。無ければ地味な灰色 */
function resolveColorHex(name: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  if (!value) return 0x9a9a9a;
  try {
    return new THREE.Color(value).getHex();
  } catch {
    return 0x9a9a9a;
  }
}

/** 2 本指の距離。1 本以下なら null */
function pinchDistance(pointers: Map<number, { x: number; y: number }>): number | null {
  if (pointers.size < 2) return null;
  const [a, b] = [...pointers.values()];
  return Math.hypot(a!.x - b!.x, a!.y - b!.y);
}

export function SpiralScene({
  summaries,
  onPressDay,
  pochi,
}: {
  summaries: DaySummary[];
  onPressDay: (date: Date) => void;
  /** 今日の日まで転がる「ぽつ」の行き先。今日がこの年に無ければ null。ラボの入り切りはこの画面が読む */
  pochi: PochiTarget | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: シーンは summaries が変わったときだけ作り直す
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // const にしても、関数宣言の中では null でない絞り込みが効かないため、別名で持つ
    const el = host;

    const total = summaries.length;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    let distance = 8;
    camera.position.set(0, 0.6, distance);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // 日の点。予定の色がある日だけ、1 つの BufferGeometry にまとめて描く。0051
    // InstancedMesh ではなく、日ごとの小さな球を 1 枚のジオメトリへ焼き込む。
    // ソフトウェアで WebGL を描く端末でも同じ 1 回の描画で済み、崩れにくい
    const baseDot = new THREE.IcosahedronGeometry(DOT_RADIUS, 1);
    const baseDotPos = baseDot.attributes.position as THREE.BufferAttribute;
    const vertsPerDot = baseDotPos.count;
    // index を持たない形のこともあるので、無ければ並び順そのままの index を作る
    const baseDotIndex =
      baseDot.index ??
      new THREE.BufferAttribute(
        Uint32Array.from({ length: vertsPerDot }, (_, i) => i),
        1,
      );
    const dotDay: Date[] = [];
    const colored: { i: number; day: DaySummary }[] = [];
    for (let i = 0; i < total; i++) {
      const day = summaries[i];
      if (day?.color) colored.push({ i, day });
    }
    const dotPositions = new Float32Array(colored.length * vertsPerDot * 3);
    const dotColors = new Float32Array(colored.length * vertsPerDot * 3);
    const dotIndices = new Uint32Array(colored.length * baseDotIndex.count);
    const color = new THREE.Color();
    colored.forEach(({ i, day }, d) => {
      const p = spiralPoint(i, total, RADIUS, HEIGHT);
      color.setHex(resolveColorHex(day.color as string));
      for (let v = 0; v < vertsPerDot; v++) {
        const dst = (d * vertsPerDot + v) * 3;
        dotPositions[dst] = baseDotPos.getX(v) + p.x;
        dotPositions[dst + 1] = baseDotPos.getY(v) + p.y;
        dotPositions[dst + 2] = baseDotPos.getZ(v) + p.z;
        dotColors[dst] = color.r;
        dotColors[dst + 1] = color.g;
        dotColors[dst + 2] = color.b;
      }
      for (let f = 0; f < baseDotIndex.count; f++) {
        dotIndices[d * baseDotIndex.count + f] = baseDotIndex.getX(f) + d * vertsPerDot;
      }
      dotDay[d] = day.date;
    });
    baseDot.dispose();
    const dotGeometry = new THREE.BufferGeometry();
    dotGeometry.setAttribute("position", new THREE.BufferAttribute(dotPositions, 3));
    dotGeometry.setAttribute("color", new THREE.BufferAttribute(dotColors, 3));
    dotGeometry.setIndex(new THREE.BufferAttribute(dotIndices, 1));
    const dotMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    const dotMesh = new THREE.Mesh(dotGeometry, dotMaterial);
    const facesPerDot = baseDotIndex.count / 3;
    group.add(dotMesh);

    // ひとコマの写真。ある日だけ Sprite を 1 つ置く
    const photoSprites: THREE.Sprite[] = [];
    const photoDay: Date[] = [];
    const photoTextures: THREE.Texture[] = [];
    for (let i = 0; i < total; i++) {
      const day = summaries[i];
      if (!day?.thumb) continue;
      const texture = new THREE.TextureLoader().load(day.thumb);
      texture.colorSpace = THREE.SRGBColorSpace;
      photoTextures.push(texture);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(material);
      const p = spiralPoint(i, total, RADIUS * 1.16, HEIGHT);
      sprite.position.set(p.x, p.y, p.z);
      sprite.scale.setScalar(PHOTO_SIZE);
      group.add(sprite);
      photoSprites.push(sprite);
      photoDay.push(day.date);
    }

    // インクのしずくの「ぽつ」。ラボで入れていて、今日がこの年にあるときだけ作る。0075、F-42
    // 半透明のガラスの材質(MeshPhysicalMaterial の transmission)にし、体の中の色をグループの色にする
    const showPochi = pochi != null && pochiEnabled();
    let pochiMesh: THREE.Mesh | null = null;
    let pochiGeometry: THREE.SphereGeometry | null = null;
    let pochiMaterial: THREE.MeshPhysicalMaterial | null = null;
    let pochiLights: THREE.Light[] = [];
    const pochiReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    const pochiStart = performance.now();
    if (showPochi) {
      pochiGeometry = new THREE.SphereGeometry(POCHI_RADIUS, 24, 16);
      pochiMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 1,
        thickness: POCHI_RADIUS * 2,
        roughness: 0.16,
        ior: 1.4,
        attenuationColor: new THREE.Color(resolveColorHex(pochi.color)),
        attenuationDistance: POCHI_RADIUS * 1.1,
      });
      pochiMesh = new THREE.Mesh(pochiGeometry, pochiMaterial);
      const start = spiralPoint(0, pochi.total, RADIUS, HEIGHT);
      pochiMesh.position.set(start.x, start.y, start.z);
      group.add(pochiMesh);

      const ambient = new THREE.HemisphereLight(0xffffff, 0x445566, 1.3);
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(2, 3, 4);
      pochiLights = [ambient, key];
      for (const light of pochiLights) scene.add(light);

      el.dataset.pochi = pochiReducedMotion ? "stopped" : "rolling";
    }

    // 大きさの調整。表示する枠の大きさに合わせる
    function resize() {
      const width = el.clientWidth || 1;
      const height = el.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    // 回す・寄る操作
    const pointers = new Map<number, { x: number; y: number }>();
    let dragLast: { x: number; y: number } | null = null;
    let pinchStart: { distance: number; radius: number } | null = null;
    let downAt = { x: 0, y: 0, time: 0 };
    let moved = 0;

    function clampDistance(d: number) {
      return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, d));
    }

    function onPointerDown(e: PointerEvent) {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      downAt = { x: e.clientX, y: e.clientY, time: performance.now() };
      moved = 0;
      if (pointers.size === 1) dragLast = { x: e.clientX, y: e.clientY };
      if (pointers.size === 2) pinchStart = { distance: pinchDistance(pointers) ?? 1, radius: distance };
    }

    function onPointerMove(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved += Math.abs(e.movementX) + Math.abs(e.movementY);

      if (pointers.size >= 2) {
        const now = pinchDistance(pointers);
        if (now && pinchStart) {
          distance = clampDistance(pinchStart.radius * (pinchStart.distance / now));
        }
        return;
      }
      if (dragLast) {
        const dx = e.clientX - dragLast.x;
        group.rotation.y += dx * ROTATE_SPEED;
        dragLast = { x: e.clientX, y: e.clientY };
      }
    }

    function pressDayNear(clientX: number, clientY: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, camera);

      const hits = raycaster.intersectObjects([dotMesh, ...photoSprites], false);
      const hit = hits[0];
      if (!hit) return;
      if (hit.object === dotMesh && hit.faceIndex != null) {
        const date = dotDay[Math.floor(hit.faceIndex / facesPerDot)];
        if (date) onPressDay(date);
        return;
      }
      const spriteIndex = photoSprites.indexOf(hit.object as THREE.Sprite);
      if (spriteIndex >= 0) {
        const date = photoDay[spriteIndex];
        if (date) onPressDay(date);
      }
    }

    function onPointerUp(e: PointerEvent) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
      if (pointers.size === 0) dragLast = null;
      const elapsed = performance.now() - downAt.time;
      if (moved < TAP_MOVE_LIMIT && elapsed < TAP_TIME_LIMIT) pressDayNear(e.clientX, e.clientY);
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      distance = clampDistance(distance + e.deltaY * 0.01);
    }

    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    host.addEventListener("wheel", onWheel, { passive: false });

    // ぽつを、今日の位置まで転がす。0075、F-42
    function updatePochi(now: number) {
      if (!pochiMesh || !pochi) return;
      const progress = pochiProgress(now - pochiStart, pochiReducedMotion);
      const p = spiralPoint(pochi.index * progress, pochi.total, RADIUS, HEIGHT);
      const next = new THREE.Vector3(p.x, p.y, p.z);
      if (progress < 1) {
        // 動いた向きへ、動いた分だけ転がって見えるよう、その軸で回す
        const delta = next.clone().sub(pochiMesh.position);
        const dist = delta.length();
        const axis = new THREE.Vector3(0, 1, 0).cross(delta);
        if (dist > 1e-6 && axis.lengthSq() > 1e-9) pochiMesh.rotateOnWorldAxis(axis.normalize(), dist / POCHI_RADIUS);
      }
      pochiMesh.position.copy(next);
      if (progress >= 1 && el.dataset.pochi !== "stopped") el.dataset.pochi = "stopped";
    }

    // 24fps ぶんの時間が経つより前は描き直さない。低い端末の重さの頭打ち
    let raf = 0;
    let lastFrame = 0;
    let stopped = false;
    function tick(now: number) {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      if (now - lastFrame < 1000 / TARGET_FPS) return;
      lastFrame = now;
      camera.position.set(0, 0.6, distance);
      camera.lookAt(0, 0, 0);
      updatePochi(now);
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(tick);

    function onVisibility() {
      if (document.hidden) {
        stopped = true;
        cancelAnimationFrame(raf);
      } else if (stopped) {
        stopped = false;
        raf = requestAnimationFrame(tick);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerUp);
      host.removeEventListener("wheel", onWheel);
      dotGeometry.dispose();
      dotMaterial.dispose();
      for (const sprite of photoSprites) sprite.material.dispose();
      for (const texture of photoTextures) texture.dispose();
      pochiGeometry?.dispose();
      pochiMaterial?.dispose();
      for (const light of pochiLights) scene.remove(light);
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
    // pochi は summaries と同じ年替わりのタイミングでしか変わらないので、依存には入れない。0051 と同じ方針
  }, [summaries]);

  return <div ref={hostRef} className="size-full touch-none" aria-hidden="true" />;
}
