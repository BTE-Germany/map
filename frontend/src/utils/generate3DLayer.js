/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + generate3DLayer.js                                                         +
 +                                                                            +
 + Copyright (c) 2022-2023 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import mapboxgl from "mapbox-gl";
import * as THREE from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader";

const loader = new GLTFLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.3/');

const generate3DLayer = (id, origin, altitude, rotate, modelURL, mapInstance) => {
    const modelOrigin = origin;
    const modelAltitude = altitude;
    const modelRotate = rotate;

    const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(
        modelOrigin,
        modelAltitude
    );

// transformation parameters to position, rotate and scale the 3D model onto the map
    const modelTransform = {
        translateX: modelAsMercatorCoordinate.x,
        translateY: modelAsMercatorCoordinate.y,
        translateZ: modelAsMercatorCoordinate.z,
        rotateX: modelRotate[0],
        rotateY: modelRotate[1],
        rotateZ: modelRotate[2],
        /* Since the 3D model is in real world meters, a scale transform needs to be
        * applied since the CustomLayerInterface expects units in MercatorCoordinates.
        */
        scale: modelAsMercatorCoordinate.meterInMercatorCoordinateUnits()
    };

// configuration of the custom layer for a 3D model per the CustomLayerInterface
    const customLayer = {
        id: id,
        type: 'custom',
        renderingMode: '3d',
        maxZoom: 13,
        onAdd: function (map, gl) {
            this.camera = new THREE.Camera();
            this.scene = new THREE.Scene();

            const light = new THREE.AmbientLight(0x282828, 0.72); // soft white light
            this.scene.add(light);
            const spotLight = new THREE.PointLight(16775643, 1.04); // soft white light
            spotLight.position.set(33, 50, 65);

            spotLight.castShadow = true;

            this.scene.add(spotLight);

            loader.setDRACOLoader(dracoLoader);
            loader.load(
                modelURL,
                (gltf) => {
                    const scene = gltf.scene;

                    const model = gltf.scene || gltf.scenes[0];
                    model.traverse((object) => {
                        const obj = object;
                        if (obj.isMesh === true) {
                            obj.material.map.magFilter = THREE.NearestFilter;
                        }
                    });
                    this.scene.add(gltf.scene);
                }
            );
            this.map = mapInstance;

            this.renderer = new THREE.WebGLRenderer({
                canvas: mapInstance.getCanvas(),
                context: gl,
                antialias: true
            });

            this.renderer.autoClear = false;
        },
        render: function (gl, matrix) {
            if (mapInstance.getZoom() < 15) return;
            const rotationX = new THREE.Matrix4().makeRotationAxis(
                new THREE.Vector3(1, 0, 0),
                modelTransform.rotateX
            );
            const rotationY = new THREE.Matrix4().makeRotationAxis(
                new THREE.Vector3(0, 1, 0),
                modelTransform.rotateY
            );
            const rotationZ = new THREE.Matrix4().makeRotationAxis(
                new THREE.Vector3(0, 0, 1),
                modelTransform.rotateZ
            );

            const m = new THREE.Matrix4().fromArray(matrix);
            const l = new THREE.Matrix4()
                .makeTranslation(
                    modelTransform.translateX,
                    modelTransform.translateY,
                    modelTransform.translateZ
                )
                .scale(
                    new THREE.Vector3(
                        modelTransform.scale,
                        -modelTransform.scale,
                        modelTransform.scale
                    )
                )
                .multiply(rotationX)
                .multiply(rotationY)
                .multiply(rotationZ);

            this.camera.projectionMatrix = m.multiply(l);
            this.renderer.resetState();
            this.renderer.render(this.scene, this.camera);
            this.map.triggerRepaint();
        }
    };

    return customLayer;


}

export default generate3DLayer;
