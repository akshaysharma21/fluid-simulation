var canvas;
var gl;
var floatExt;
var supportLinear;
const JACOBI_ITERATIONS = 60;
let time = 0.01;
let color=[0.9, 0.05, 0.05];
let splatRadius = 0.0001;
let randomMouseColor = false;

var run = function(){
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var box = new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, box, gl.STATIC_DRAW);

    var indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    addDensity(0, 0);
    var loop = function () {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      console.log(time);
      step(time);

      gl.useProgram(mainProgram);
      gl.uniform2f(
      gl.getUniformLocation(mainProgram, "texSize"),
      fDensity.texSizeX,
      fDensity.texSizeY
      );
      gl.uniform1i(gl.getUniformLocation(mainProgram, "tex"), bDensity.bind(0));
      drawOnScreen(mainProgram, null);

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
};

var step = function(time){
  gl.viewport(0,0,canvas.width, canvas.height);

  gl.useProgram(advectProgram);
  gl.uniform1f(gl.getUniformLocation(advectProgram, "timeStep"), time);
  gl.uniform1i(gl.getUniformLocation(advectProgram, "advectTex"), fVelocity.bind(0));
  gl.uniform1i(gl.getUniformLocation(advectProgram, "inputTex"), fVelocity.bind(0));
  gl.uniform2f(gl.getUniformLocation(advectProgram, "texSize"), fVelocity.texSizeX, fVelocity.texSizeY);
  drawOnScreen(advectProgram, bVelocity.fbo);

  let tempVel = bVelocity;
  bVelocity = fVelocity;
  fVelocity=tempVel;

  gl.useProgram(divergenceProgram);
  gl.uniform2f(gl.getUniformLocation(divergenceProgram, "texSize"), fVelocity.texSizeX, fVelocity.texSizeY);
  gl.uniform1i(gl.getUniformLocation(divergenceProgram, "inputVelocity"), fVelocity.bind(0));
  drawOnScreen(divergenceProgram, divergence.fbo);

  gl.useProgram(pressureProgram);
  gl.uniform2f(gl.getUniformLocation(pressureProgram, "texSize"), divergence.texSizeX, divergence.texSizeY);
  gl.uniform1i(gl.getUniformLocation(pressureProgram, "uDivergence"), divergence.bind(0));
  gl.uniform1f(gl.getUniformLocation(pressureProgram, "alpha"), 1/8);
  gl.uniform1f(gl.getUniformLocation(pressureProgram, "inverseBeta"), 0.25);
  for (var i = 0; i < JACOBI_ITERATIONS; i++) {
    gl.uniform1i(gl.getUniformLocation(pressureProgram, "uPressure"), fPressure.bind(1));
    drawOnScreen(pressureProgram, bPressure.fbo);

    var temp = fPressure;
    fPressure = bPressure;
    bPressure = temp;
  }


  gl.useProgram(gradientProgram);
  gl.uniform2f(gl.getUniformLocation(gradientProgram, "texSize"), fPressure.texSizeX, fPressure.texSizeY);
  gl.uniform1i(gl.getUniformLocation(gradientProgram, "pressure"), fPressure.bind(0));
  gl.uniform1i(gl.getUniformLocation(gradientProgram, "velocity"), fVelocity.bind(1));
  drawOnScreen(gradientProgram, bVelocity.fbo);


  gl.useProgram(advectProgram);
  gl.uniform1f(gl.getUniformLocation(advectProgram, "timeStep"), time);
  gl.uniform1i(gl.getUniformLocation(advectProgram, "advectTex"), fDensity.bind(0));
  gl.uniform1i(gl.getUniformLocation(advectProgram, "inputTex"), fVelocity.bind(1));
  gl.uniform2f(gl.getUniformLocation(advectProgram, "texSize"), fVelocity.texSizeX, fVelocity.texSizeY);
  drawOnScreen(advectProgram, bDensity.fbo);

  tempVel = bVelocity;
  bVelocity = fVelocity;
  fVelocity=tempVel;

  gl.useProgram(fadeProgram);
  gl.uniform2f(gl.getUniformLocation(fadeProgram, "texSize"), bDensity.texSizeX, bDensity.texSizeY);
  gl.uniform1i(gl.getUniformLocation(fadeProgram, "texture"), bDensity.bind(0));
  drawOnScreen(fadeProgram, fDensity.fbo);
  
}

var InitDemo = function () {
    canvas = document.getElementById("draw-surface");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    console.log("This is working");
    gl = canvas.getContext("webgl");
    if (!gl) {
      alert("Browser does not support webgl");
    }
    floatExt = gl.getExtension("OES_texture_half_float");
    supportLinear = gl.getExtension("OES_texture_half_float_linear");
  };

class FBOTexture {
    constructor(w, h) {
      gl.activeTexture(gl.TEXTURE0);
      this.texture = gl.createTexture();
      this.createTexture(w, h);
  
      this.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.texture,
        0
      );
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
      this.texSizeX = 1.0 / w;
      this.texSizeY = 1.0 / h;
    }
  
    createTexture(w, h) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        w,
        h,
        0,
        gl.RGBA,
        floatExt.HALF_FLOAT_OES,
        null
      );
    }
    bind(num) {
      gl.activeTexture(gl.TEXTURE0 + num);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      return num;
    }
};

let divergence, fDensity, fVelocity, fPressure;
let bDensity, bVelocity, bPressure;
var InitFrameBuffers = function () {
  var width = canvas.width;
  var height = canvas.height;
  fDensity = new FBOTexture(width, height);
  bDensity = new FBOTexture(width, height);

  fVelocity = new FBOTexture(width, height);
  bVelocity = new FBOTexture(width, height);

  fPressure = new FBOTexture(width, height);
  bPressure = new FBOTexture(width, height);

  divergence = new FBOTexture(width, height);
};

var createProgram = function(vertexShaderText, fragmentShaderText){
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(vertexShader, vertexShaderText);
    gl.shaderSource(fragmentShader, fragmentShaderText);

    gl.compileShader(vertexShader);

    if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)){
        console.error('ERROR COMPILING THE VERTEX SHADER!', gl.getShaderInfoLog(vertexShader));
        return;
    }

    gl.compileShader(fragmentShader);
    if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)){
        console.error('ERROR compiling fragment shader!', gl.getShaderInfoLog(fragmentShader));
        return;
    }

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('ERROR linking program!', gl.getProgramInfoLog(program));
        return;
    }
    gl.validateProgram(program);
    if(!gl.getProgramParameter(program, gl.VALIDATE_STATUS)){
        console.error('ERROR validating program!', gl.getProgramInfoLog(program));
        return;
    }
    return program;
};

var drawOnScreen = function (program, frameBuffer) {
    var positionALoc = gl.getAttribLocation(program, "vertPosition");
    gl.vertexAttribPointer(
      positionALoc,
      2,
      gl.FLOAT,
      gl.FALSE,
      2 * Float32Array.BYTES_PER_ELEMENT,
      0
    );
    gl.enableVertexAttribArray(positionALoc);
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
};

InitDemo();

let splatProgram = createProgram(
    document.getElementById("baseVertexShader").innerHTML,
    document.getElementById("splatShader").innerHTML
);

let mainProgram = createProgram(
    document.getElementById("baseVertexShader").innerHTML,
    document.getElementById("fragmentShader").innerHTML
);

let advectProgram = createProgram(
    document.getElementById("baseVertexShader").innerHTML,
    document.getElementById("advectShader").innerHTML
)

let divergenceProgram = createProgram(
    document.getElementById("baseVertexShader").innerHTML,
    document.getElementById("divergenceShader").innerHTML
);

let pressureProgram = createProgram(
    document.getElementById("baseVertexShader").innerHTML,
    document.getElementById("jacobiShader").innerHTML
);

let gradientProgram = createProgram(
    document.getElementById("baseVertexShader").innerHTML,
    document.getElementById("gradientSubtractShader").innerHTML
);

let fadeProgram = createProgram(
    document.getElementById("baseVertexShader").innerHTML,
    document.getElementById("fadeFragmentShader").innerHTML
);


function addDensity(posX, posY) {
    gl.useProgram(splatProgram);
    gl.uniform1i(gl.getUniformLocation(splatProgram, "tex"), fDensity.bind(0));
    gl.uniform2f(gl.getUniformLocation(splatProgram,"point"), posX, posY);
    gl.uniform3f(gl.getUniformLocation(splatProgram,"color"), color[0], color[1], color[2]);
    gl.uniform1f(gl.getUniformLocation(splatProgram,"radius"), splatRadius);
    drawOnScreen(splatProgram, bDensity.fbo);
  
    var tempDens = fDensity;
    fDensity = bDensity;
    bDensity = tempDens;
  
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function addVelocity(posX, posY, dx, dy){
    gl.useProgram(splatProgram);
    gl.uniform1i(gl.getUniformLocation(splatProgram, "tex"), fVelocity.bind(0));
    gl.uniform2f(gl.getUniformLocation(splatProgram,"point"), posX, posY);
    gl.uniform3f(gl.getUniformLocation(splatProgram,"color"), dx*5000, dy*5000 , 0.0);
    gl.uniform1f(gl.getUniformLocation(splatProgram,"radius"), splatRadius);
    drawOnScreen(splatProgram, bVelocity.fbo);

    var tempVel = fVelocity;
    fVelocity = bVelocity;
    bVelocity = tempVel;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

var mousePressed = false;
var prevX, prevY;
var points = [];

var mouseDown = function(event){
    if(randomMouseColor){
      color[0] = Math.random();
      color[1] = Math.random();
      color[2] = Math.random();
    } 
    mousePressed = true;
    prevX = parseInt(event.x) / canvas.width;
    prevY = 1.0 - parseInt(event.y) / canvas.height;
    addDensity(prevX, prevY);
    
};

var mouseDragged =  function(event){
    canvas = document.getElementById('draw-surface');
    var mouseX = parseInt(event.x) / canvas.width;
    var mouseY = (canvas.height - parseInt(event.y)) / canvas.height;
    if(mousePressed){
        addDensity(mouseX, mouseY);
        addVelocity(mouseX, mouseY, mouseX - prevX, mouseY - prevY);
        prevX = mouseX;
        prevY = mouseY;
    }
};

var mouseUp = function(){
    mousePressed = false;
};

var keyPress = function(event){
  if(event.key=="ArrowUp"){
    if(splatRadius<=0.001){
      splatRadius+=0.00005;
    }
  }
  if(event.key=="ArrowDown"){
    if(splatRadius>=0.00001 || splatRadius-0.00005>0.00001){
      splatRadius-=0.00005;
    }
  }
  if(event.key==" "){
    changeColor();
  }
  if(event.key=="r" || event.key=="r"){
    randomMouseColor = !randomMouseColor;
  }
}

var changeColor = function(){
  color[0] = Math.random();
  color[1] = Math.random();
  color[2] = Math.random(); 
}

InitFrameBuffers();
run();
