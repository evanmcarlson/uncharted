const wireframeTextureComponent = {
  init() {
    const applyMaterial = () => {
      const mesh = this.el.getObject3D('mesh')
      if (!mesh) {
        return
      }

      const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: 0x0091ff,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      })

      mesh.traverse((node) => {
        if (node.isMesh && node.material) {
          node.material = wireframeMaterial
        }
      })
    }

    this.el.addEventListener('model-loaded', applyMaterial)
  },
}
export {wireframeTextureComponent}
