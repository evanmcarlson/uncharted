// Save the original opacity values, and multiply them by a modifier
const modelFadeComponent = {
  schema: {opacity: {default: 0}},
  init() {
    this.nodeMap = {}
    this.prepareMap.bind(this)
    this.traverseMesh.bind(this)

    this.el.addEventListener('model-loaded', (e) => {
      this.prepareMap()
      this.update()
    })

    this.prepareMap()
    this.update()
  },
  prepareMap() {
    this.traverseMesh((node) => {
      this.nodeMap[node.uuid] = node.material.opacity
    })
  },
  update() {
    this.traverseMesh((node) => {
      node.material.opacity = this.nodeMap[node.uuid] * this.data.opacity
      node.material.transparent = node.material.opacity < 1.0
      node.material.needsUpdate = true
    })
  },
  remove() {
    this.traverseMesh((node) => {
      node.material.opacity = this.nodeMap[node.uuid]
      node.material.transparent = node.material.opacity < 1.0
      node.material.needsUpdate = true
    })
  },
  traverseMesh(func) {
    const mesh = this.el.getObject3D('mesh')
    if (!mesh) {
      return
    }
    mesh.traverse((node) => {
      if (node.isMesh) {
        func(node)
      }
    })
  },
}
export {modelFadeComponent}
