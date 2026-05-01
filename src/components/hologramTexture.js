const hologramTextureComponent = {
  init() {
    const applyMaterial = () => {
      const mesh = this.el.getObject3D('mesh')
      if (!mesh) {
        return
      }

      const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
      })

      mesh.traverse((node) => {
        if (node.isMesh && node.material) {
          node.material = material
        }
      })
    }

    this.el.addEventListener('model-loaded', applyMaterial)
  },
}
export {hologramTextureComponent}
