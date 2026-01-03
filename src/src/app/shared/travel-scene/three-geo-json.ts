import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';

export interface GeoJSONOptions {
  json: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.GeometryCollection;
  radius: number;
  color?: THREE.ColorRepresentation;
}

interface GeoJSONGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][] | number[][][][];
}

export function drawThreeGeo({ json, radius, color = 0x3498db }: GeoJSONOptions): THREE.Object3D {
  const container = new THREE.Object3D();
  container.rotation.x = -Math.PI * 0.5;

  const xValues: number[] = [];
  const yValues: number[] = [];
  const zValues: number[] = [];
  const jsonGeom = createGeometryArray(json);

  let coordinateArray: number[][] = [];

  for (let geomNum = 0; geomNum < jsonGeom.length; geomNum++) {
    const geom = jsonGeom[geomNum];

    if (geom.type === 'Point') {
      convertToSphereCoords(geom.coordinates as number[], radius, xValues, yValues, zValues);
      drawParticle(container, xValues[0], yValues[0], zValues[0], color);
      clearArrays(xValues, yValues, zValues);
    } else if (geom.type === 'MultiPoint') {
      const coords = geom.coordinates as number[][];
      for (let pointNum = 0; pointNum < coords.length; pointNum++) {
        convertToSphereCoords(coords[pointNum], radius, xValues, yValues, zValues);
        drawParticle(container, xValues[0], yValues[0], zValues[0], color);
        clearArrays(xValues, yValues, zValues);
      }
    } else if (geom.type === 'LineString') {
      coordinateArray = createCoordinateArray(geom.coordinates as number[][]);
      for (let pointNum = 0; pointNum < coordinateArray.length; pointNum++) {
        convertToSphereCoords(coordinateArray[pointNum], radius, xValues, yValues, zValues);
      }
      drawLine(container, xValues, yValues, zValues, color);
      clearArrays(xValues, yValues, zValues);
    } else if (geom.type === 'Polygon') {
      const coords = geom.coordinates as number[][][];
      for (let segmentNum = 0; segmentNum < coords.length; segmentNum++) {
        coordinateArray = createCoordinateArray(coords[segmentNum]);
        for (let pointNum = 0; pointNum < coordinateArray.length; pointNum++) {
          convertToSphereCoords(coordinateArray[pointNum], radius, xValues, yValues, zValues);
        }
        drawLine(container, xValues, yValues, zValues, color);
        clearArrays(xValues, yValues, zValues);
      }
    } else if (geom.type === 'MultiLineString') {
      const coords = geom.coordinates as number[][][];
      for (let segmentNum = 0; segmentNum < coords.length; segmentNum++) {
        coordinateArray = createCoordinateArray(coords[segmentNum]);
        for (let pointNum = 0; pointNum < coordinateArray.length; pointNum++) {
          convertToSphereCoords(coordinateArray[pointNum], radius, xValues, yValues, zValues);
        }
        drawLine(container, xValues, yValues, zValues, color);
        clearArrays(xValues, yValues, zValues);
      }
    } else if (geom.type === 'MultiPolygon') {
      const coords = geom.coordinates as number[][][][];
      for (let polygonNum = 0; polygonNum < coords.length; polygonNum++) {
        for (let segmentNum = 0; segmentNum < coords[polygonNum].length; segmentNum++) {
          coordinateArray = createCoordinateArray(coords[polygonNum][segmentNum]);
          for (let pointNum = 0; pointNum < coordinateArray.length; pointNum++) {
            convertToSphereCoords(coordinateArray[pointNum], radius, xValues, yValues, zValues);
          }
          drawLine(container, xValues, yValues, zValues, color);
          clearArrays(xValues, yValues, zValues);
        }
      }
    }
  }

  return container;
}

function createGeometryArray(
  json: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.GeometryCollection,
): GeoJSONGeometry[] {
  const geometryArray: GeoJSONGeometry[] = [];

  if (json.type === 'Feature') {
    geometryArray.push(json.geometry as GeoJSONGeometry);
  } else if (json.type === 'FeatureCollection') {
    for (let featureNum = 0; featureNum < json.features.length; featureNum++) {
      geometryArray.push(json.features[featureNum].geometry as GeoJSONGeometry);
    }
  } else if (json.type === 'GeometryCollection') {
    for (let geomNum = 0; geomNum < json.geometries.length; geomNum++) {
      geometryArray.push(json.geometries[geomNum] as GeoJSONGeometry);
    }
  }

  return geometryArray;
}

function createCoordinateArray(feature: number[][]): number[][] {
  const tempArray: number[][] = [];

  for (let pointNum = 0; pointNum < feature.length; pointNum++) {
    const point1 = feature[pointNum];
    const point2 = feature[pointNum - 1];

    if (pointNum > 0) {
      if (needsInterpolation(point2, point1)) {
        let interpolationArray = [point2, point1];
        interpolationArray = interpolatePoints(interpolationArray);
        for (let interPointNum = 0; interPointNum < interpolationArray.length; interPointNum++) {
          tempArray.push(interpolationArray[interPointNum]);
        }
      } else {
        tempArray.push(point1);
      }
    } else {
      tempArray.push(point1);
    }
  }

  return tempArray;
}

function needsInterpolation(point2: number[], point1: number[]): boolean {
  const lon1 = point1[0];
  const lat1 = point1[1];
  const lon2 = point2[0];
  const lat2 = point2[1];
  const lonDistance = Math.abs(lon1 - lon2);
  const latDistance = Math.abs(lat1 - lat2);

  return lonDistance > 5 || latDistance > 5;
}

function interpolatePoints(interpolationArray: number[][]): number[][] {
  let tempArray: number[][] = [];

  for (let pointNum = 0; pointNum < interpolationArray.length - 1; pointNum++) {
    const point1 = interpolationArray[pointNum];
    const point2 = interpolationArray[pointNum + 1];

    if (needsInterpolation(point2, point1)) {
      tempArray.push(point1);
      tempArray.push(getMidpoint(point1, point2));
    } else {
      tempArray.push(point1);
    }
  }

  tempArray.push(interpolationArray[interpolationArray.length - 1]);

  if (tempArray.length > interpolationArray.length) {
    tempArray = interpolatePoints(tempArray);
  }

  return tempArray;
}

function getMidpoint(point1: number[], point2: number[]): number[] {
  const midpointLon = (point1[0] + point2[0]) / 2;
  const midpointLat = (point1[1] + point2[1]) / 2;
  return [midpointLon, midpointLat];
}

function convertToSphereCoords(
  coordinatesArray: number[],
  sphereRadius: number,
  xValues: number[],
  yValues: number[],
  zValues: number[],
): void {
  const lon = coordinatesArray[0];
  const lat = coordinatesArray[1];

  xValues.push(Math.cos((lat * Math.PI) / 180) * Math.cos((lon * Math.PI) / 180) * sphereRadius);
  yValues.push(Math.cos((lat * Math.PI) / 180) * Math.sin((lon * Math.PI) / 180) * sphereRadius);
  zValues.push(Math.sin((lat * Math.PI) / 180) * sphereRadius);
}

function drawParticle(
  container: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  color: THREE.ColorRepresentation,
): void {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([x, y, z], 3));

  const particleMaterial = new THREE.PointsMaterial({ color, size: 0.1 });
  const particle = new THREE.Points(geo, particleMaterial);
  container.add(particle);
}

function drawLine(
  container: THREE.Object3D,
  xValues: number[],
  yValues: number[],
  zValues: number[],
  color: THREE.ColorRepresentation,
): void {
  const lineGeo = new LineGeometry();
  const verts: number[] = [];

  for (let i = 0; i < xValues.length; i++) {
    verts.push(xValues[i], yValues[i], zValues[i]);
  }

  lineGeo.setPositions(verts);

  const lineMaterial = new LineMaterial({
    color: color instanceof THREE.Color ? color.getHex() : (color as number),
    linewidth: 2,
    fog: true,
  });

  const line = new Line2(lineGeo, lineMaterial);
  line.computeLineDistances();
  container.add(line);
}

function clearArrays(xValues: number[], yValues: number[], zValues: number[]): void {
  xValues.length = 0;
  yValues.length = 0;
  zValues.length = 0;
}
