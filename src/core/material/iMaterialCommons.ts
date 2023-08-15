import {
    AddEquation,
    AlwaysStencilFunc,
    ColorManagement,
    FrontSide,
    KeepStencilOp,
    LessEqualDepth,
    Material,
    MaterialParameters,
    NormalBlending,
    OneMinusSrcAlphaFactor,
    Scene,
    Shader,
    SrcAlphaFactor,
    WebGLRenderer,
} from 'three'
import {copyProps} from 'ts-browser-helpers'
import {copyMaterialUserData} from '../../utils/serialization'
import {MaterialExtender, MaterialExtension} from '../../materials'
import {IScene} from '../IScene'
import {IMaterial, IMaterialEvent, IMaterialSetDirtyOptions} from '../IMaterial'
import {isInScene} from '../../three'

/**
 * Map of all material properties and their default values in three.js - Material.js
 * This is used to copy properties and serialize/deserialize them.
 * @note: Upgrade note: keep updated from three.js/src/Material.js:22
 */
export const threeMaterialPropList = {
    // uuid: '', // DONT COPY, should remain commented
    name: '',
    blending: NormalBlending,
    side: FrontSide,
    vertexColors: false,
    opacity: 1,
    transparent: false,
    blendSrc: SrcAlphaFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendEquation: AddEquation,
    blendSrcAlpha: null,
    blendDstAlpha: null,
    blendEquationAlpha: null,
    depthFunc: LessEqualDepth,
    depthTest: true,
    depthWrite: true,
    stencilWriteMask: 0xff,
    stencilFunc: AlwaysStencilFunc,
    stencilRef: 0,
    stencilFuncMask: 0xff,
    stencilFail: KeepStencilOp,
    stencilZFail: KeepStencilOp,
    stencilZPass: KeepStencilOp,
    stencilWrite: false,
    clippingPlanes: null,
    clipIntersection: false,
    clipShadows: false,
    shadowSide: null,
    colorWrite: true,
    precision: null,
    polygonOffset: false,
    polygonOffsetFactor: 0,
    polygonOffsetUnits: 0,
    dithering: false,
    alphaToCoverage: false,
    premultipliedAlpha: false,
    forceSinglePass: false,
    visible: true,
    toneMapped: true,
    userData: {},
    // wireframeLinecap: 'round',
    // wireframeLinejoin: 'round',
    alphaTest: 0,
    // fog: true,
}
export const iMaterialCommons = {
    threeMaterialPropList,
    setDirty: function(this: IMaterial, options?: IMaterialSetDirtyOptions): void {
        this.needsUpdate = true
        this.dispatchEvent({bubbleToObject: true, bubbleToParent: true, ...options, type: 'materialUpdate'}) // this sets sceneUpdate in root scene
        this.uiConfig?.uiRefresh?.(true, 'postFrame', 1)
    },
    setValues: (superSetValues: Material['setValues']): IMaterial['setValues'] =>
        function(this: IMaterial, parameters: Material | (MaterialParameters & {type?: string})): IMaterial {

            // legacy check for old color management(non-sRGB) in material.setValues todo: move this to Material.fromJSON
            const legacyColors = (parameters as any)?.metadata && (parameters as any)?.metadata.version <= 4.5
            const lastColorManagementEnabled = ColorManagement.enabled
            if (legacyColors) ColorManagement.enabled = false

            const propList = this.constructor.MaterialProperties
            const params: any = !propList ? {...parameters} : copyProps(parameters, {} as any, Array.from(Object.keys(propList)))

            // remove undefined values
            for (const key of Object.keys(params)) if (params[key] === undefined) delete params[key]

            const userData = params.userData
            delete params.userData

            // todo: can migrate to @serialize for properties which have UI etc and use super.setValues for the rest like threeMaterialPropList
            superSetValues.call(this, params)

            if (userData) copyMaterialUserData(this.userData, userData)

            if (legacyColors) ColorManagement.enabled = lastColorManagementEnabled

            this.setDirty?.()
            return this
        },
    dispose: (superDispose: Material<any, any>['dispose']): IMaterial['dispose'] =>
        function(this: IMaterial, force = true): void {
            if (!force && (this.userData.disposeOnIdle === false || isInScene(this))) return
            superDispose.call(this)
        },
    clone: (superClone: Material<any, any>['clone']): IMaterial['clone'] =>
        function(this: IMaterial): IMaterial {
            if (!this.userData.cloneId) {
                this.userData.cloneId = '0'
            }
            if (!this.userData.cloneCount) {
                this.userData.cloneCount = 0
            }
            this.userData.cloneCount += 1

            const material: IMaterial = this.generator?.({})?.setValues(this, false) ?? superClone.call(this)

            material.userData.cloneId = material.userData.cloneId + '_' + this.userData.cloneCount
            material.userData.cloneCount = 0
            material.name = material.name + '_' + material.userData.cloneId

            return material
        },
    dispatchEvent: (superDispatchEvent: Material['dispatchEvent']): IMaterial['dispatchEvent'] =>
        function(this: IMaterial, event: IMaterialEvent): void {
            superDispatchEvent.call(this, event)
            const type = event.type
            if (event.bubbleToObject && (
                type === 'beforeDeserialize' || type === 'materialUpdate' || type === 'textureUpdate' // todo - add more events
            )) {
                this.appliedMeshes.forEach(m => m.dispatchEvent({...event, material: this, type}))
            }
        },

    registerMaterialExtensions: function(this: IMaterial, customMaterialExtensions: MaterialExtension[]): void {
        MaterialExtender.RegisterExtensions(this, customMaterialExtensions)
    },
    unregisterMaterialExtensions: function(this: IMaterial, customMaterialExtensions: MaterialExtension[]): void {
        MaterialExtender.UnregisterExtensions(this, customMaterialExtensions)
    },

    onBeforeCompile: function(this: IMaterial, shader: Shader, renderer: WebGLRenderer): void {
        if (this.materialExtensions) MaterialExtender.ApplyMaterialExtensions(this, shader, this.materialExtensions, renderer)

        this.dispatchEvent({type: 'beforeCompile', shader, renderer})

        shader.fragmentShader = shader.fragmentShader.replaceAll('#glMarker', '// ')
        shader.vertexShader = shader.vertexShader.replaceAll('#glMarker', '// ')
    },

    onBeforeRender: function(this: IMaterial, renderer, scene: Scene & Partial<IScene>, camera, geometry, object) {
        if (this.envMapIntensity !== undefined && !this.userData.separateEnvMapIntensity && scene.envMapIntensity !== undefined) {
            this.userData.__envIntensity = this.envMapIntensity
            this.envMapIntensity = scene.envMapIntensity
        }
        if (this.defines && this.envMap !== undefined && scene.fixedEnvMapDirection !== undefined) {
            if (scene.fixedEnvMapDirection) {
                if (!this.defines.FIX_ENV_DIRECTION) {
                    this.defines.FIX_ENV_DIRECTION = '1'
                    this.needsUpdate = true
                }
            } else if (this.defines.FIX_ENV_DIRECTION !== undefined) {
                delete this.defines.FIX_ENV_DIRECTION
                this.needsUpdate = true
            }
        }
        this.dispatchEvent({type: 'beforeRender', renderer, scene, camera, geometry, object})
    } as IMaterial['onBeforeRender'],
    onAfterRender: function(this: IMaterial, renderer, scene: Scene & Partial<IScene>, camera, geometry, object) {
        if (this.userData.__envIntensity !== undefined) {
            this.envMapIntensity = this.userData.__envIntensity
            delete this.userData.__envIntensity
        }
        this.dispatchEvent({type: 'afterRender', renderer, scene, camera, geometry, object})
    } as IMaterial['onAfterRender'],

    upgradeMaterial: upgradeMaterial,
    // todo;
} as const

/**
 * Convert a standard three.js {@link Material} to {@link IMaterial}
 */
export function upgradeMaterial(this: IMaterial): IMaterial {
    if (!this.isMaterial) {
        console.error('Material is not a material', this)
        return this
    }
    if (!this.setDirty) this.setDirty = iMaterialCommons.setDirty
    if (!this.appliedMeshes) this.appliedMeshes = new Set()
    if (!this.userData) this.userData = {}
    this.userData.uuid = this.uuid

    // legacy
    if (!this.userData.setDirty) this.userData.setDirty = (e: any) => {
        console.warn('userData.setDirty is deprecated. Use setDirty instead.')
        this.setDirty(e)
    }

    if (this.assetType === 'material') return this // already upgraded
    this.assetType = 'material'
    this.setValues = iMaterialCommons.setValues(this.setValues)
    this.dispose = iMaterialCommons.dispose(this.dispose)
    this.clone = iMaterialCommons.clone(this.clone)
    this.dispatchEvent = iMaterialCommons.dispatchEvent(this.dispatchEvent)

    // todo: add uiconfig, serialization, other stuff from UnlitMaterial?
    // dispose uiconfig etc. on dispose

    return this
}
