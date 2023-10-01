import {_testFinish, IObject3D, PickingPlugin, ThreeViewer} from 'threepipe'
import {TweakpaneUiPlugin} from '@threepipe/plugin-tweakpane'

async function init() {

    const viewer = new ThreeViewer({
        canvas: document.getElementById('mcanvas') as HTMLCanvasElement,
    })

    const picking = viewer.addPluginSync(PickingPlugin)
    picking.hoverEnabled = true

    await viewer.setEnvironmentMap('https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr')
    await viewer.load<IObject3D>('https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf')

    const ui = viewer.addPluginSync(new TweakpaneUiPlugin(true))
    ui.setupPluginUi(PickingPlugin)

    picking.addEventListener('hitObject', (e)=>{
        console.log('Hit object', e)
    })
    picking.addEventListener('selectedObjectChanged', (e)=>{
        console.log('Selected Object Changed', e)
    })

    picking.addEventListener('hoverObjectChanged', (e)=>{
        console.log('Hover Object Changed', e)
    })

}

init().then(_testFinish)