const iframeEventsComponent = {
  init() {
    this.el.addEventListener('realityready', () => {
      window.parent.postMessage('realityready', '*')
    })

    this.el.addEventListener('solved', () => {
      window.parent.postMessage('solved', '*')
    })

    // todo could add a timeline to the bottom of screen to show animation length
  },
}

export {iframeEventsComponent}
