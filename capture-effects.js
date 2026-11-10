import * as THREE from 'three';

// Synthesized locally: no audio downloads, tracking, or cross-origin dependencies.
export class CaptureEffects {
    constructor(scene) {
        this.scene = scene;
        this.bursts = [];
        this.geometry = new THREE.IcosahedronGeometry(0.065, 0);
        this.ringGeometry = new THREE.RingGeometry(0.24, 0.29, 40);
        this.context = null;
        this.enabled = true;
        try { this.enabled = localStorage.getItem('chess-sound') !== 'off'; } catch {}
    }

    unlockAudio() {
        if (!this.enabled) return;
        try {
            const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
            if (!Audio) return;
            this.context ||= new Audio();
            if (this.context.state === 'suspended') this.context.resume().catch(() => {});
        } catch { /* Audio support must never block a move. */ }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        try { localStorage.setItem('chess-sound', enabled ? 'on' : 'off'); } catch {}
        if (enabled) this.unlockAudio();
    }

    playSound() {
        if (!this.enabled || this.context?.state !== 'running') return;
        try {
            const ctx = this.context;
            const now = ctx.currentTime;
            const output = ctx.createGain();
            output.gain.setValueAtTime(0.0001, now);
            output.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
            output.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
            output.connect(ctx.destination);
            for (const [frequency, type] of [[190, 'triangle'], [760, 'sine']]) {
                const tone = ctx.createOscillator();
                tone.type = type;
                tone.frequency.setValueAtTime(frequency, now);
                tone.frequency.exponentialRampToValueAtTime(frequency * 0.3, now + 0.24);
                tone.connect(output);
                tone.onended = () => { tone.disconnect(); output.disconnect(); };
                tone.start(now);
                tone.stop(now + 0.3);
            }
        } catch { /* Continue gameplay if the audio device is unavailable. */ }
    }

    capture(position, team, reducedMotion) {
        this.playSound();
        if (reducedMotion) return;
        const material = new THREE.MeshBasicMaterial({
            color: team === 'w' ? 0x35d9ff : 0xad73ff,
            transparent: true, opacity: 0.9, depthWrite: false
        });
        const group = new THREE.Group();
        group.position.copy(position);
        group.position.y = 0.12;
        const ring = new THREE.Mesh(this.ringGeometry, material);
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);
        const particles = [];
        for (let i = 0; i < 16; i++) {
            const angle = i * Math.PI * 2 / 16;
            const mesh = new THREE.Mesh(this.geometry, material);
            group.add(mesh);
            particles.push({ mesh, vx: Math.cos(angle) * 1.2, vz: Math.sin(angle) * 1.2, vy: 1.4 + (i % 3) * 0.3 });
        }
        this.scene.add(group);
        this.bursts.push({ group, ring, material, particles, start: performance.now() });
    }

    update(now) {
        for (let i = this.bursts.length - 1; i >= 0; i--) {
            const burst = this.bursts[i];
            const t = Math.max(0, (now - burst.start) / 1000);
            if (t >= 0.65) {
                this.scene.remove(burst.group);
                burst.material.dispose();
                this.bursts.splice(i, 1);
                continue;
            }
            burst.material.opacity = 0.9 * (1 - t / 0.65);
            burst.ring.scale.setScalar(1 + t * 4);
            for (const { mesh, vx, vy, vz } of burst.particles) {
                mesh.position.set(vx * t, Math.max(0, vy * t - 2 * t * t), vz * t);
                mesh.rotation.set(t * 6, t * 4, t * 3);
                mesh.scale.setScalar(1 - t / 0.65);
            }
        }
    }

    clear() {
        for (const burst of this.bursts) {
            this.scene.remove(burst.group);
            burst.material.dispose();
        }
        this.bursts.length = 0;
    }
}
