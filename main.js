'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let sphere;
let userPoint;
let angle, surface2, video, track, texture, texture2, camera;

function deg2rad(angle) {
  return angle * Math.PI / 180;
}


// Constructor
function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.iVertexTextureBuffer = gl.createBuffer();
  this.count = 0;
  this.textureCount = 0;

  this.BufferData = function(vertices) {

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

    this.count = vertices.length / 3;
  }
  this.TextureBufferData = function(vertices) {

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexTextureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

    this.textureCount = vertices.length / 2;
  }

  this.Draw = function() {

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexTextureBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertexTexture, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertexTexture);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
  }
  this.DrawSphere = function() {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
  }
}


// Constructor
function ShaderProgram(name, program) {

  this.name = name;
  this.prog = program;

  // Location of the attribute variable in the shader program.
  this.iAttribVertex = -1;
  this.iAttribVertexTexture = -1;
  // Location of the uniform matrix representing the combined transformation.
  this.iModelViewProjectionMatrix = -1;

  this.iTMU = -1;
  this.iUserPoint = -1;
  this.iAngle = 0;
  this.iTranslateSphere = -1;

  this.Use = function() {
    gl.useProgram(this.prog);
  }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw2() {
  draw()
  window.requestAnimationFrame(draw2)
}
function draw() {
  camera.inputChange();

  gl.clearColor(1., 1., 1., 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  /* Set the values of the projection transformation */
  let projection = m4.perspective(Math.PI / 8, 1, 8, 12);

  /* Get the view matrix from the SimpleRotator object.*/
  let modelView = spaceball.getViewMatrix();
  let modelView2 = m4.identity();

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.0);
  let rotateToPointZero2 = m4.axisRotation([1, 0, 0], 0.0);
  let translateToPointZero = m4.translation(0, 0, -10);
  let translateToPointZero2 = m4.multiply(m4.translation(-2, -2, -10), m4.scaling(4, 4, 1));

  let matAccum0 = m4.multiply(getRotationMatrix(-sensor.a,sensor.b,sensor.g), m4.multiply(rotateToPointZero, modelView));
  let matAccum02 = m4.multiply(rotateToPointZero2, modelView2);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);
  let matAccum12 = m4.multiply(translateToPointZero2, matAccum02);

  /* Multiply the projection matrix times the modelview matrix to give the
     combined transformation matrix, and send that to the shader program. */
  let modelViewProjection = m4.multiply(projection, matAccum1);

  gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);

  gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);


  let translate = cylindrical(map(userPoint.x, 0, 1, 0.25, 1), map(userPoint.y, 0, 1, 0, Math.PI * 2))
  gl.uniform3fv(shProgram.iTranslateSphere, [translate.x, translate.y, translate.z])
  gl.uniform1f(shProgram.iB, 1);
  // sphere.DrawSphere();
  gl.uniform1i(shProgram.iTMU, 0);
  gl.enable(gl.TEXTURE_2D);
  gl.uniform2fv(shProgram.iUserPoint, [userPoint.x, userPoint.y]);
  gl.uniform1f(shProgram.iAngle, angle);
  gl.uniform1f(shProgram.iB, -1);
  gl.uniform3fv(shProgram.iTranslateSphere, [-0., -0., -0.])
  gl.bindTexture(gl.TEXTURE_2D, texture2);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    video
  );
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum12);
  surface2.Draw();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
  //gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
  camera.ApplyLeftFrustum();
  gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, camera.mProjectionMatrix);
  gl.colorMask(false, true, true, false);
  surface.Draw();
  gl.clear(gl.DEPTH_BUFFER_BIT);
  camera.ApplyRightFrustum();
  gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, camera.mProjectionMatrix);
  gl.colorMask(true, false, false, false);
  surface.Draw();
  gl.colorMask(true, true, true, true);


}

function StereoCamera(
  Convergence,
  EyeSeparation,
  AspectRatio,
  FOV,
  NearClippingDistance,
  FarClippingDistance
) {
  this.mConvergence = Convergence;
  this.mEyeSeparation = EyeSeparation;
  this.mAspectRatio = AspectRatio;
  this.mFOV = FOV;
  this.mNearClippingDistance = NearClippingDistance;
  this.mFarClippingDistance = FarClippingDistance;

  this.mProjectionMatrix = null;
  this.mModelViewMatrix = null;

  this.ApplyLeftFrustum = function() {
    let top, bottom, left, right;
    top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
    bottom = -top;

    let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
    let b = a - this.mEyeSeparation / 2;
    let c = a + this.mEyeSeparation / 2;

    left = (-b * this.mNearClippingDistance) / this.mConvergence;
    right = (c * this.mNearClippingDistance) / this.mConvergence;

    // Set the Projection Matrix
    this.mProjectionMatrix = m4.frustum(
      left,
      right,
      bottom,
      top,
      this.mNearClippingDistance,
      this.mFarClippingDistance
    );

    // Displace the world to right
    this.mModelViewMatrix = m4.translation(
      this.mEyeSeparation / 2,
      0.0,
      0.0
    );
  };

  this.ApplyRightFrustum = function() {
    let top, bottom, left, right;
    top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
    bottom = -top;

    let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
    let b = a - this.mEyeSeparation / 2;
    let c = a + this.mEyeSeparation / 2;

    left = (-c * this.mNearClippingDistance) / this.mConvergence;
    right = (b * this.mNearClippingDistance) / this.mConvergence;

    // Set the Projection Matrix
    this.mProjectionMatrix = m4.frustum(
      left,
      right,
      bottom,
      top,
      this.mNearClippingDistance,
      this.mFarClippingDistance
    );

    // Displace the world to left
    this.mModelViewMatrix = m4.translation(
      -this.mEyeSeparation / 2,
      0.0,
      0.0
    );
  };

  this.inputChange = function() {
    let eyeSep = 70.0;
    eyeSep = document.getElementById("eye").value - 0.0;
    this.mEyeSeparation = eyeSep;
    let fov = 0.8;
    fov = document.getElementById("view").value - 0.0;
    this.mFOV = fov;
    let nearClip = 5.0;
    nearClip = document.getElementById("near").value - 0.0;
    this.mNearClippingDistance = nearClip
    let convergence = 2000.0;
    convergence = document.getElementById("con").value - 0.0;
    this.mConvergence = convergence
  }
}

function CreateSurfaceData() {
  let vertexList = [];
  const STEP = 0.1
  for (let uc = 0.25; uc < 1; uc += STEP) {
    for (let vc = 0; vc < Math.PI * 2; vc += STEP) {
      const v1 = cylindrical(uc, vc);
      const v2 = cylindrical(uc + STEP, vc);
      const v3 = cylindrical(uc, vc + STEP);
      const v4 = cylindrical(uc + STEP, vc + STEP);
      vertexList.push(v1.x, v1.y, v1.z)
      vertexList.push(v2.x, v2.y, v2.z)
      vertexList.push(v3.x, v3.y, v3.z)
      vertexList.push(v2.x, v2.y, v2.z)
      vertexList.push(v4.x, v4.y, v4.z)
      vertexList.push(v3.x, v3.y, v3.z)
    }
  }
  return vertexList;
}
function map(val, f1, t1, f2, t2) {
  let m;
  m = (val - f1) * (t2 - f2) / (t1 - f1) + f2
  return Math.min(Math.max(m, f2), t2);
}
function CreateSurfaceTextureData() {
  let vertexTextureList = [];
  const STEP = 0.1
  for (let uc = 0.25; uc < 1; uc += STEP) {
    for (let vc = 0; vc < Math.PI * 2; vc += STEP) {
      let u = map(uc, 0.25, 1, 0, 1)
      let v = map(vc, 0, Math.PI * 2, 0, 1)
      vertexTextureList.push(u, v)
      u = map(uc + STEP, 0.25, 1, 0, 1)
      vertexTextureList.push(u, v)
      u = map(uc, 0.25, 1, 0, 1)
      v = map(vc + STEP, 0, Math.PI * 2, 0, 1)
      vertexTextureList.push(u, v)
      u = map(uc + STEP, 0.25, 1, 0, 1)
      v = map(vc, 0, Math.PI * 2, 0, 1)
      vertexTextureList.push(u, v)
      v = map(vc + STEP, 0, Math.PI * 2, 0, 1)
      vertexTextureList.push(u, v)
      u = map(uc, 0.25, 1, 0, 1)
      v = map(vc + STEP, 0, Math.PI * 2, 0, 1)
      vertexTextureList.push(u, v)
    }
  }
  return vertexTextureList;
}

function cylindrical(r, theta) {
  let x = (-Math.cos(theta) / (2 * r)) - (r ** 3 * Math.cos(3 * theta)) / 6;
  let y = (-Math.sin(theta) / (2 * r)) + (r ** 3 * Math.sin(3 * theta)) / 6;
  let z = r * Math.cos(theta);
  const COEF = 1;
  return {
    x: x * COEF,
    y: y * COEF,
    z: z * COEF
  }
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram('Basic', prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
  shProgram.iAttribVertexTexture = gl.getAttribLocation(prog, "vertexTexture");
  shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
  shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
  shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "ProjectionMatrix");
  shProgram.iTMU = gl.getUniformLocation(prog, 'TMU');
  shProgram.iUserPoint = gl.getUniformLocation(prog, 'userPoint');;
  shProgram.iAngle = gl.getUniformLocation(prog, 'rotate');
  shProgram.iTranslateSphere = gl.getUniformLocation(prog, 'translateSphere');
  shProgram.iB = gl.getUniformLocation(prog, 'b');

  LoadTexture()
  surface = new Model('Surface');
  surface.BufferData(CreateSurfaceData());
  surface.TextureBufferData(CreateSurfaceTextureData());
  sphere = new Model('Sphere');
  sphere.BufferData(CreateSphereSurface())
  surface2 = new Model('Plane');
  surface2.BufferData([0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0]);
  surface2.TextureBufferData([1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1]);

  gl.enable(gl.DEPTH_TEST);
}

function CreateSphereSurface(r = 0.1) {
  let vertexList = [];
  let lon = -Math.PI;
  let lat = -Math.PI * 0.5;
  while (lon < Math.PI) {
    while (lat < Math.PI * 0.5) {
      let v1 = sphereSurfaceDate(r, lon, lat);
      let v2 = sphereSurfaceDate(r, lon + 0.5, lat);
      let v3 = sphereSurfaceDate(r, lon, lat + 0.5);
      let v4 = sphereSurfaceDate(r, lon + 0.5, lat + 0.5);
      vertexList.push(v1.x, v1.y, v1.z);
      vertexList.push(v2.x, v2.y, v2.z);
      vertexList.push(v3.x, v3.y, v3.z);
      vertexList.push(v2.x, v2.y, v2.z);
      vertexList.push(v4.x, v4.y, v4.z);
      vertexList.push(v3.x, v3.y, v3.z);
      lat += 0.5;
    }
    lat = -Math.PI * 0.5
    lon += 0.5;
  }
  return vertexList;
}

function sphereSurfaceDate(r, u, v) {
  let x = r * Math.sin(u) * Math.cos(v);
  let y = r * Math.sin(u) * Math.sin(v);
  let z = r * Math.cos(u);
  return { x: x, y: y, z: z };
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
  }
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
  }
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
  }
  return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
let sensor = {
  a: 0,
  b: 0,
  g: 0
}
function init() {
  window.addEventListener('deviceorientation', e => {
    sensor.a = e.alpha;
    sensor.b = e.beta;
    sensor.g = e.gamma;
  }, true);
  let canvas;
  userPoint = { x: 0.5, y: 0.5 }
  angle = 0.0;
  try {
    canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    video = document.createElement('video');
    video.setAttribute('autoplay', true);
    window.vid = video;
    getWebcam();
    texture2 = CreateWebCamTexture();
    camera = new StereoCamera(
      2000,
      70.0,
      1,
      0.8,
      5,
      100
    );
    if (!gl) {
      throw "Browser does not support WebGL";
    }
  }
  catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not get a WebGL graphics context.</p>";
    return;
  }
  try {
    initGL();  // initialize the WebGL graphics context
  }
  catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);

  draw2();
}

function LoadTexture() {
  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const image = new Image();
  image.crossOrigin = 'anonymus';

  image.src = "https://raw.githubusercontent.com/Dunadan48/VGGI_LAB/main/Polantis-Sponge-3d.png";
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image
    );
    draw()
  }
}

onmousemove = (e) => {
  angle = map(e.clientX, 0, window.outerWidth, 0, Math.PI)
  draw()
};
window.onkeydown = (e) => {
  switch (e.keyCode) {
    case 87:
      userPoint.y -= 0.01;
      break;
    case 83:
      userPoint.y += 0.01;
      break;
    case 65:
      userPoint.x += 0.01;
      break;
    case 68:
      userPoint.x -= 0.01;
      break;
  }
  userPoint.x = Math.max(0.01, Math.min(userPoint.x, 0.999))
  userPoint.y = Math.max(0.01, Math.min(userPoint.y, 0.999))
  draw();
}

function CreateWebCamTexture() {
  let textureID = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, textureID);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return textureID;
}

function getWebcam() {
  navigator.getUserMedia({ video: true, audio: false }, function(stream) {
    video.srcObject = stream;
    track = stream.getTracks()[0];
  }, function(e) {
    console.error('Rejected!', e);
  });
}

var degtorad = Math.PI / 180; // Degree-to-Radian conversion

function getRotationMatrix(alpha, beta, gamma) {

  var _x = beta ? beta * degtorad : 0; // beta value
  var _y = gamma ? gamma * degtorad : 0; // gamma value
  var _z = alpha ? alpha * degtorad : 0; // alpha value

  var cX = Math.cos(_x);
  var cY = Math.cos(_y);
  var cZ = Math.cos(_z);
  var sX = Math.sin(_x);
  var sY = Math.sin(_y);
  var sZ = Math.sin(_z);

  //
  // ZXY rotation matrix construction.
  //

  var m11 = cZ * cY - sZ * sX * sY;
  var m12 = - cX * sZ;
  var m13 = cY * sZ * sX + cZ * sY;

  var m21 = cY * sZ + cZ * sX * sY;
  var m22 = cZ * cX;
  var m23 = sZ * sY - cZ * cY * sX;

  var m31 = - cX * sY;
  var m32 = sX;
  var m33 = cX * cY;

  return [
    m11, m12, m13, 0,
    m21, m22, m23, 0,
    m31, m32, m33, 0,
    0, 0, 0, 1
  ];

};