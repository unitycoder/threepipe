import {_testFinish, IObject3D, ThreeViewer, TweakpaneUiPlugin} from 'threepipe'

async function init() {

    const viewer = new ThreeViewer({
        canvas: document.getElementById('mcanvas') as HTMLCanvasElement,
        msaa: true,
    })

    const ui = viewer.addPluginSync(new TweakpaneUiPlugin(true))

    ui.appendChild(viewer.scene.uiConfig)

    await viewer.setEnvironmentMap('https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr')
    await viewer.load<IObject3D>('https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf', {
        autoCenter: true,
        autoScale: true,
    })


}

init().then(_testFinish)
