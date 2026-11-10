import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CaptureEffects } from '../capture-effects.js';

test('capture burst animates and releases its scene objects after its lifetime', () => {
    const scene = new THREE.Scene();
    const effects = new CaptureEffects(scene);
    effects.capture(new THREE.Vector3(2, 0, 3), 'b', false);
    assert.equal(scene.children.length, 1);
    const burst = effects.bursts[0];
    assert.equal(burst.material.color.getHex(), 0xad73ff);
    assert.equal(burst.group.position.x, 2);
    effects.update(burst.start + 300);
    assert.ok(burst.material.opacity < 0.9);
    assert.ok(burst.ring.scale.x > 1);
    effects.update(burst.start + 700);
    assert.equal(scene.children.length, 0);
    assert.equal(effects.bursts.length, 0);
});
test('reduced motion skips particles and reset clears overlapping bursts', () => {
    const scene = new THREE.Scene();
    const effects = new CaptureEffects(scene);
    effects.capture(new THREE.Vector3(), 'w', true);
    assert.equal(scene.children.length, 0);
    effects.capture(new THREE.Vector3(), 'w', false);
    effects.capture(new THREE.Vector3(), 'b', false);
    assert.equal(scene.children.length, 2);
    effects.clear();
    assert.equal(scene.children.length, 0);
});
test('capture audio plays only when enabled and the audio context is running', () => {
    const effects = new CaptureEffects(new THREE.Scene());
    let tones = 0;
    const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
    effects.context = {
        state: 'running', currentTime: 0, destination: {},
        createGain: () => ({ gain: param, connect() {}, disconnect() {} }),
        createOscillator: () => { tones++; return { frequency: param, connect() {}, disconnect() {}, start() {}, stop() {} }; }
    };
    effects.enabled = true;
    effects.playSound();
    assert.equal(tones, 2);
    effects.setEnabled(false);
    effects.playSound();
    assert.equal(tones, 2);
    effects.enabled = true;
    effects.context.state = 'suspended';
    effects.playSound();
    assert.equal(tones, 2);
});
