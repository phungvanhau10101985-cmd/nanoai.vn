import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appNameFromGeoGebraPath,
  buildSpatialGeoGebraUrl,
  geoGebraAppForEmbed,
  geogebraCommandIsSpatial,
  spatialGeoGebraCommand,
} from './geogebra-spatial'

function commandOf(raw: string): string | null {
  const url = buildSpatialGeoGebraUrl(raw)
  if (!url) return null
  return new URL(url).searchParams.get('command')
}

test('mặt và khối 3D thành lệnh GeoGebra 3D', () => {
  assert.equal(commandOf('z=x^2+y^2'), 'z=x^2+y^2')
  assert.equal(commandOf('z = x² + y²'), 'z=x^(2)+y^(2)')
  assert.equal(commandOf('Z = X^2 + Y^2'), 'z=x^2+y^2')
  assert.equal(commandOf('x^2+y^2+z^2=1'), 'x^2+y^2+z^2=1')
  assert.equal(commandOf('f(x, y) = sin(x)*cos(y)'), 'f(x,y)=sin(x)*cos(y)')
  assert.equal(commandOf('A=(1, 2, 3)'), 'A=(1,2,3)')
  assert.equal(commandOf('Sphere((0, 0, 0), 2)'), 'Sphere((0,0,0),2)')
  assert.equal(commandOf('z=0,5x^2+y^2'), 'z=0.5x^2+y^2')
  assert.equal(commandOf('z=x^2+y^2, x>=0'), 'z=If(x>=0,x^2+y^2)')
  assert.equal(commandOf('z=x^2+y^2;z=x+y'), 'z=x^2+y^2;z=x+y')
  assert.equal(commandOf('x + y + z = 6'), 'x+y+z=6')
  assert.equal(commandOf('Đồ thị: z=x^2+y^2'), 'z=x^2+y^2')
  assert.equal(commandOf('A=(1,2,3)\nB=(4,0,1)\nu=Vector(A,B)'), 'A=(1,2,3);B=(4,0,1);u=Vector(A,B)')
  assert.match(buildSpatialGeoGebraUrl('z=x^2+y^2') ?? '', /^https:\/\/www\.geogebra\.org\/3d\?command=/)
})

test('đồ thị 2D không bị kéo sang 3D', () => {
  assert.equal(spatialGeoGebraCommand('y=x^2'), null)
  assert.equal(spatialGeoGebraCommand('Y=x^2-2x^2'), null)
  assert.equal(spatialGeoGebraCommand('y=x^2, x>=0'), null)
  assert.equal(spatialGeoGebraCommand('y=x^2, y=2x'), null)
  assert.equal(spatialGeoGebraCommand('f(x)=x^2'), null)
  assert.equal(spatialGeoGebraCommand('https://www.geogebra.org/calculator?command=f(x)=x^2'), null)
  assert.equal(geogebraCommandIsSpatial('f(x)=x^2'), false)
  assert.equal(geogebraCommandIsSpatial('z=x^2+y^2'), true)
})

test('đường dẫn GeoGebra chọn app 2D hoặc 3D', () => {
  assert.equal(appNameFromGeoGebraPath('/3d'), '3d')
  assert.equal(appNameFromGeoGebraPath('/3d/abc123'), '3d')
  assert.equal(appNameFromGeoGebraPath('/calculator/abc123'), 'suite')
  assert.equal(appNameFromGeoGebraPath('/m/abc123'), 'classic')
  assert.equal(geoGebraAppForEmbed('/calculator', 'f(x)=x^2'), 'classic')
  assert.equal(geoGebraAppForEmbed('/calculator', 'z=x^2+y^2'), '3d')
  assert.equal(geoGebraAppForEmbed('/3d', 'f(x)=x^2'), '3d')
  assert.equal(geoGebraAppForEmbed('/geometry', 'Segment((0,0),(1,1))'), 'geometry')
})
