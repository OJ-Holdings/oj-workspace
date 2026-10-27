import * as THREE from 'three';

/** World-space triplanar detail avoids stretched cliff UVs and visible tiling.
 * StandardMaterial still owns physical light, fog, shadow and output conversion. */
export function alpineMaterial(grain: THREE.Texture, rock: THREE.Color, snow: THREE.Color, ground: THREE.Color, compact: boolean, keep: <T extends {dispose:()=>void}>(item:T)=>T, onAssets:(state:string)=>void) {
  const material = new THREE.MeshStandardMaterial({ color: 'white', roughness: 0.91, metalness: 0, bumpMap: grain, bumpScale: 0.12 });
  const maps = { color: {value:grain}, height: {value:grain}, ready: {value:0} };
  let loaded=0,active=true;
  material.addEventListener('dispose',()=>{active=false;});
  const loader=new THREE.TextureLoader();
  for (const kind of ['color','height'] as const) {
    const texture=keep(loader.load(`/hyperborea/rock-${kind}-${compact?'compact':'desktop'}.webp`,t=>{
      if(!active){t.dispose();return;}
      maps[kind].value=t; if(++loaded===2) { maps.ready.value=1; onAssets('photographic'); }
    },undefined,()=>{ if(active)onAssets('procedural-fallback'); }));
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=grain.anisotropy;
    texture.colorSpace=kind==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
  }
  material.customProgramCacheKey = () => 'hyperborea-alpine-v2';
  material.onBeforeCompile = shader => {
    shader.uniforms.hbGrain = { value: grain };
    shader.uniforms.hbRock = { value: rock };
    shader.uniforms.hbSnow = { value: snow };
    shader.uniforms.hbGround = { value: ground };
    shader.uniforms.hbRockPhoto=maps.color;shader.uniforms.hbHeightPhoto=maps.height;shader.uniforms.hbPhotoReady=maps.ready;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 hbPosition; varying vec3 hbNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      hbPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      hbNormal = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D hbGrain; uniform vec3 hbRock; uniform vec3 hbSnow; uniform vec3 hbGround;
      uniform sampler2D hbRockPhoto; uniform sampler2D hbHeightPhoto; uniform float hbPhotoReady;
      varying vec3 hbPosition; varying vec3 hbNormal;
      float hbTri(vec3 p, vec3 weights) {
        return dot(vec3(texture2D(hbGrain,p.yz).r, texture2D(hbGrain,p.xz).r, texture2D(hbGrain,p.xy).r),weights);
      }
      vec3 hbPhoto(vec3 p, vec3 weights) {
        return texture2D(hbRockPhoto,p.yz).rgb*weights.x + texture2D(hbRockPhoto,p.xz).rgb*weights.y + texture2D(hbRockPhoto,p.xy).rgb*weights.z;
      }
      float hbHeight(vec3 p, vec3 weights) {
        return dot(vec3(texture2D(hbHeightPhoto,p.yz).r,texture2D(hbHeightPhoto,p.xz).r,texture2D(hbHeightPhoto,p.xy).r),weights);
      }
      float hbRelief; float hbSnowAmount; float hbIceAmount;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 hbP = hbPosition;
      vec3 hbN = normalize(hbNormal);
      vec3 hbWeights = pow(abs(hbN), vec3(4.0)); hbWeights /= max(dot(hbWeights,vec3(1.0)),0.001);
      float hbBroad = hbTri(hbP * 0.027, hbWeights);
      float hbFine = hbTri(hbP * 0.72, hbWeights);
      float hbGravel = hbTri(hbP * 3.8, hbWeights);
      float hbStrata = sin(hbP.y * 3.1 + hbP.x * 0.19 + hbBroad * 6.0);
      float hbFissure = pow(1.0 - abs(sin(hbP.y * 1.2 + hbP.x * 0.5 + hbBroad * 4.0)), 18.0);
      float hbShade = 0.65 + hbBroad * 0.58 + hbFine * 0.3 + hbStrata * 0.075 - hbFissure * 0.22;
      vec3 hbStone = hbRock * hbShade + vec3(0.025,0.019,0.012) * hbBroad;
      vec3 hbPhotographicRock=hbPhoto(hbP*0.035,hbWeights);
      float hbLuma=dot(hbPhotographicRock,vec3(0.2126,0.7152,0.0722));
      hbPhotographicRock=mix(vec3(hbLuma),hbPhotographicRock,0.45);
      hbStone=mix(hbStone,hbPhotographicRock*(0.65+hbShade*0.45),hbPhotoReady*0.92);
      hbSnowAmount = smoothstep(13.0,49.0,hbP.y + hbBroad*13.0) * smoothstep(0.30,0.78,hbN.y);
      hbSnowAmount = max(hbSnowAmount, smoothstep(77.0,98.0,hbP.y)*0.62);
      float hbChannel = abs(hbP.x*0.84 - hbP.z*0.54 + sin(hbP.y*0.14)*2.0);
      hbIceAmount = (1.0-smoothstep(3.0,12.0,hbChannel))*smoothstep(21.0,38.0,hbP.y)*(1.0-smoothstep(78.0,94.0,hbP.y))*smoothstep(0.18,0.7,hbN.y);
      float hbCrevasse = pow(1.0-abs(sin(hbP.y*1.9 + hbBroad*9.0 + hbP.x*0.1)),24.0);
      vec3 hbIce = mix(vec3(0.25,0.46,0.58),hbSnow*0.86,hbFine*0.65);
      hbIce *= 1.0 - hbCrevasse*0.7;
      vec3 hbAlbedo = mix(hbStone,hbSnow*(0.84+hbFine*0.15),hbSnowAmount);
      diffuseColor.rgb = mix(hbAlbedo,hbIce,hbIceAmount*0.88);
      diffuseColor.rgb = mix(diffuseColor.rgb,hbGround,smoothstep(107.0,155.0,length(hbP.xz)));
      hbRelief = mix(hbFine*0.10+hbGravel*0.018+hbStrata*0.035-hbFissure*0.08,hbFine*0.018+hbGravel*0.008,hbSnowAmount);
      hbRelief -= hbCrevasse*hbIceAmount*0.12;
      hbRelief += hbHeight(hbP*0.035,hbWeights)*0.32*hbPhotoReady*(1.0-hbSnowAmount)*(1.0-hbIceAmount);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(0.95,mix(0.7,0.34,hbIceAmount),max(hbSnowAmount,hbIceAmount));`)
      .replace('#include <normal_fragment_maps>', `
      normal = perturbNormalArb(-vViewPosition,normal,vec2(dFdx(hbRelief),dFdy(hbRelief)),faceDirection);`);
  };
  return material;
}
