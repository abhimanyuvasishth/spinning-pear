"use strict";

// Global variables
var gl, canvas, program;
var Uniforms, Attributes;
var M, N, O;
var uTime;

function webGLinit(){
	canvas = document.getElementById("gl-canvas");
	gl = WebGLUtils.setupWebGL( canvas );
	if(!gl){alert("WebGL setup failed!");}
			
	// set clear color 
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
			
	//Enable depth test
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL); // since WebGL uses left handed
	gl.clearDepth(1.0); 	 // coordinate system
		
	// Load shaders and initialize attribute buffers
	program = initShaders( gl, "vertex-shader", "fragment-shader" );
	gl.useProgram( program );
}


window.onload = function init() {
			// Set up WebGL
			webGLinit();

			// Get attribute and uniform locations
			Attributes = getAttributeLocations("vPosition", "vNormal", "vTexCoords",
							"vTangent", "vBitangent");

			Uniforms = getUniformLocations(
			  "ModelMatrix", "NormalTransformationMatrix",
			  "CameraMatrix", "TrackBallMatrix", "CameraPosition",
			  "Ka", "Kd", "Ks", "shininess", "Ia", "Id", "Is", "LightPosition", 
			  "diffuseMapSampler", "normalMapSampler", "useNormalMap", "specularMapSampler", "useSpecularMap"
			);

			// Set up virtual trackball
			TrackBall(); 	

			// Set up Camera 
			var eye = vec3(0,0, 3.0);
			var at = vec3(0, 0 ,0);
			var up = vec3(0,1,0);
			var C = Camera();
			C.lookAt(eye,at,up);
			C.setPerspective(60,1,0.1,10);

			// Set Light 
			var L = Light();
			L.setPosition(vec3(0,0,5));
			L.setParameters(vec3(0.3, 0.3, 0.3), vec3(1,1,1), vec3(1,1,1) );
			
			// skin, flower, tail
			M = skin;
			N = tail;
			O = flower;

			var map;
			map = "pear"; // wood, steel, brick
			M.diffuseMap = map + "_diffuse.jpg";
			M.normalMap = map + "_normal_map.jpg";
			M.specularMap = map + "_specular.jpg";

			var normalButton = document.getElementById("Toggle Normal Mapping");
			var useNormalMap = 1;
			gl.uniform1i(Uniforms.useNormalMap, useNormalMap);
			normalButton.onclick = function(){ useNormalMap*=-1;
				gl.uniform1i(Uniforms.useNormalMap, useNormalMap);
			};

			var specularButton = document.getElementById("Toggle Specular Mapping");
			var useSpecularMap = 1;
			gl.uniform1i(Uniforms.useSpecularMap, useSpecularMap);
			specularButton.onclick = function(){ useSpecularMap*=-1;
				gl.uniform1i(Uniforms.useSpecularMap, useSpecularMap);
				console.log(Uniforms);
			};

			objInit(M);
			objInit(N);
			objInit(O);
			uTime = gl.getUniformLocation(program,"Time");
			requestAnimationFrame(render);
};


function render(now){
	gl.uniform1f(uTime, now);
	requestAnimationFrame(render);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	M.draw();
	N.draw();
	O.draw();

}

//------------------------- objInit ----------------------------------------
function objInit(Obj){

	var vBuffer, nBuffer, iBuffer, tBuffer, tanBuffer, bitanBuffer;
	var diffuseMapTexture, normalMapTexture, specularMapTexture;
	var ModelMatrix = mat4(), NormalTransformationMatrix = mat3();
	var numItems = 3*Obj.triangles.length;

	var normalsPresent = (Obj.normals!==undefined) && (Obj.normals.length > 0);
	var texCoordsPresent = (Obj.texCoords!==undefined) && (Obj.texCoords.length > 0);
	var usingDiffuseMap = texCoordsPresent && (Obj.diffuseMap!== "");
	var usingNormalMap = texCoordsPresent && (Obj.normalMap!== "");
	var usingSpecularMap = texCoordsPresent && (Obj.specularMap!== "");
	
	if(!normalsPresent){
		computeNormals();
	}

	if(usingDiffuseMap){
		console.log(Obj.diffuseMap);
		// we use texture unit 0 for diffuse map
		gl.activeTexture(gl.TEXTURE0);
		diffuseMapTexture = setupTexture(Obj.diffuseMap); 
		gl.uniform1i(Uniforms.diffuseMapSampler, 0);
	}

	if(usingNormalMap){
		computeTangentsAndBitangents();
		// we use texture unit 1 for normal map
		gl.activeTexture(gl.TEXTURE1);
		normalMapTexture = setupTexture(Obj.normalMap);
		gl.uniform1i(Uniforms.normalMapSampler, 1);
	}

	if(usingSpecularMap){
		console.log(Obj.specularMap);
		// we use texture unit 1 for normal map
		gl.activeTexture(gl.TEXTURE2);
		specularMapTexture = setupTexture(Obj.specularMap);
		gl.uniform1i(Uniforms.specularMapSampler, 2);
	}

	setupBuffers(); // for vertex positions, normals, texCoords, tangents, bitangents

	Obj.setModelMatrix = function(m){// m is 4x4 matrix
		ModelMatrix = m;
		NormalTransformationMatrix = 
			inverse3 ( mat3(m[0][0], m[1][0], m[2][0],
							m[0][1], m[1][1], m[2][1],
							m[0][2], m[1][2], m[2][2] ) );
	}
	
	Obj.draw = function(){
		// Set attribute pointers
		gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
		gl.vertexAttribPointer(Attributes.vPosition, 3, gl.FLOAT, false, 0, 0);
	
		gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
		gl.vertexAttribPointer(Attributes.vNormal, 3, gl.FLOAT, false, 0, 0);

		if(texCoordsPresent){
			gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
			gl.vertexAttribPointer(Attributes.vTexCoords, 2, gl.FLOAT, false, 0 ,0);
		}

		if(usingDiffuseMap){
			// we use texture unit 0 for diffuse map
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, diffuseMapTexture);
		}

		if(usingNormalMap){
			gl.bindBuffer(gl.ARRAY_BUFFER, tanBuffer);
			gl.vertexAttribPointer(Attributes.vTangent, 3, gl.FLOAT, false, 0, 0);
			gl.bindBuffer(gl.ARRAY_BUFFER, bitanBuffer);
			gl.vertexAttribPointer(Attributes.vBitangent, 3, gl.FLOAT, false, 0, 0);

			// we use texture unit 1 for diffuse map
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, normalMapTexture);
		}

		if(usingSpecularMap){
			// we use texture unit 0 for diffuse map
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, specularMapTexture);
		}

		// Set material properties
		gl.uniform3fv(Uniforms.Ka, flatten(Obj.material.Ka));
		gl.uniform3fv(Uniforms.Kd, flatten(Obj.material.Kd));
		gl.uniform3fv(Uniforms.Ks, flatten(Obj.material.Ks));
		gl.uniform1f(Uniforms.shininess, Obj.material.shininess);

		// Set model matrix and the matrix for transforming normal vectors
		gl.uniformMatrix4fv(Uniforms.ModelMatrix, gl.FALSE, flatten(ModelMatrix));
		gl.uniformMatrix3fv(Uniforms.NormalTransformationMatrix, gl.FALSE, flatten(NormalTransformationMatrix));

		// Draw
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
		gl.drawElements(gl.TRIANGLES, numItems, gl.UNSIGNED_SHORT, 0);
	}

	
	function setupBuffers(){
		vBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, flatten(Obj.positions), gl.STATIC_DRAW);

		nBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, flatten(Obj.normals), gl.STATIC_DRAW);

		iBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(flatten(Obj.triangles)),gl.STATIC_DRAW);

		if(texCoordsPresent){
			tBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, flatten(Obj.texCoords), gl.STATIC_DRAW);
		}

		if(usingNormalMap){
			tanBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, tanBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, flatten(Obj.tangents), gl.STATIC_DRAW);

			bitanBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, bitanBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, flatten(Obj.bitangents), gl.STATIC_DRAW); 		
		}
	}
	
	function setupTexture(src){
		var texture = gl.createTexture();
		texture.image = new Image();
		texture.image.onload = function(){handler(texture)};
		texture.image.src = src;

		function handler(texture){
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		}
		return texture;
	}


	function computeNormals(){
		// Go over each triangle and compute the normals.
		// The normal at a vertex is the weighted sum of the normals of adjacent
		// triangles. The weights of a triangle is proportional to its area.
		var pos = Obj.positions;
		var nor = Obj.normals;
		var tri = Obj.triangles;
		var i;
		for(i = 0; i < pos.length; ++i){
			nor[i] = vec3(0, 0, 0);
		}
		for(i = 0; i < tri.length; ++i ){
			var t = tri[i];
			var v0 = vec3(pos[t[0]]);
			var v1 = vec3(pos[t[1]]);
			var v2 = vec3(pos[t[2]]);
			var v01 = subtract(v1,v0);
			var v12 = subtract(v2,v1);
			var n = cross(v01, v12);// we don't normalize so that the effect of
			// large triangles is large and that of small triangles is small
			
			nor[t[0]] = add(nor[t[0]], n);
			nor[t[1]] = add(nor[t[1]], n);
			nor[t[2]] = add(nor[t[2]], n);
		}
		for(i = 0; i < pos.length; ++i){
			nor[i] = normalize(nor[i]); 
		}
	}

	function computeTangentsAndBitangents(){
		//compute tangent and bitangent for each vertex
		var tri = Obj.triangles;
		var pos = Obj.positions;
		var tex = Obj.texCoords;
		var T, B, E1, E2, DU1, DV1, DU2, DV2;
		var a, b, c, t;
		var i,j;
		Obj.tangents = [];
		Obj.bitangents = [];
		for(i = 0; i < pos.length; ++i){
			Obj.tangents[i] = vec3(0,0,0);
			Obj.bitangents[i] = vec3(0,0,0);
		}

		for(i = 0; i < tri.length; ++i){
			t = tri[i];
			a = t[0], b = t[1], c = t[2];
			//following the notation in slides 
			E1 = subtract(vec3(pos[b]), vec3(pos[a]));
			E2 = subtract(vec3(pos[c]), vec3(pos[b]));
			DU1 = tex[b][0] - tex[a][0];
			DV1 = tex[b][1] - tex[a][1];
			DU2 = tex[c][0] - tex[b][0];
			DV2 = tex[c][1] - tex[b][1];
			B = vec3();
			T = vec3();
			for(j=0; j<3; ++j){
				T[j] = DV2*E1[j] - DV1*E2[j];
				B[j] = -DU2*E1[j] + DU1*E2[j];
			}
			// (DU1*DV2 - DU2*DV1) is the area of the triangle in texture coordinates
			// So, the area of the triangle is (DU1*DV2 - DU2*DV1)*length(T)*length(B).
			// Since we didn't divide by (DU1*DV2 - DU2*DV1) and we didn't normalize T and B,
			// we just need scale T by length(B) and B by length of T to make both proportional
			// to the area of the triangle.

			var lt = length(T);
			var lb = length(B);
			T = scale(lb, T);
			B = scale(lt, B);

			// Add T and B to tangent and bitangent resp. at all three vertices
			Obj.tangents[a] = add(Obj.tangents[a], T);
			Obj.tangents[b] = add(Obj.tangents[a], T);
			Obj.tangents[c] = add(Obj.tangents[a], T);
			Obj.bitangents[a] = add(Obj.bitangents[a], B);
			Obj.bitangents[b] = add(Obj.bitangents[b], B);
			Obj.bitangents[c] = add(Obj.bitangents[c], B);
		}

		for(i = 0; i < pos.length; ++i){
			Obj.tangents[i] = normalize(Obj.tangents[i]);
			Obj.bitangents[i] = normalize(Obj.bitangents[i]);
		}

	}
}


//------------------------- TRACKBALL --------------------------------

function TrackBall(){
	var TrackBallMatrix, lastVector, tracking = false;
	
	TrackBallMatrix = mat4(); // initialize TrackBallMatrix
	gl.uniformMatrix4fv(Uniforms.TrackBallMatrix, gl.FALSE, flatten(TrackBallMatrix));

	//set event handlers
	canvas.onmousemove = mousemove;
	canvas.onmousedown = mousedown;
	canvas.onmouseup = mouseup;
	canvas.onwheel = wheel;

	function mousedown(event){
	  lastVector = getMouseDirectionVector(event);
	  tracking = true;
	}

	function mouseup(){
		tracking = false;
	}

	function mousemove(event){ 
		if(tracking && event.buttons===1){
			var p1 = lastVector;
			var p2 = getMouseDirectionVector(event);
			lastVector = p2;
			var n = cross(p1,p2);
			if(length(n)!=0){
				var theta = 5*Math.asin(length(n))*180/Math.PI;
				TrackBallMatrix = mult(rotate(theta, n), TrackBallMatrix);
				gl.uniformMatrix4fv(Uniforms.TrackBallMatrix, gl.FALSE, flatten(TrackBallMatrix));
			}
		}
	}

	function getMouseDirectionVector(event){
	  var r = 2.0;
	  var x = -1+2*event.offsetX/canvas.width;
	  var y = -1+2*(canvas.height- event.offsetY)/canvas.height;
	  var z = Math.sqrt(r*r-x*x-y*y);
	  return normalize(vec3(x,y,z));
	}

	function wheel(event){
		var s = (1 - event.deltaY/500);
		TrackBallMatrix = mult(scalem(s,s,s), TrackBallMatrix);
		gl.uniformMatrix4fv(Uniforms.TrackBallMatrix, gl.FALSE, flatten(TrackBallMatrix));

	}
}

//-----------------------CAMERA ----------------------------------
function Camera(){
	// set defaults
	var eye = vec3(0,0, 2.5);
	var at = vec3(0, 0 ,0);
	var up = vec3(0,1,0);
	var Mcam= cameraMatrix(eye,at,up);
	var P = perspectiveMatrix(60,1,0.1,10);
	setUniforms();

	var C =  { };

	C.lookAt = function(eye,at,up){
		Mcam = cameraMatrix(eye,at,up);
		setUniforms();
	};

	C.setPerspective = function(fovy, aspect, near, far){
		P = perspectiveMatrix(fovy, aspect, near, far );
		setUniforms();
	}
	
							
	C.setOrthographic = function (r,l,t,b,n,f){
		P = orthoProjMatrix(r,l,t,b,n,f);
		setUniforms();

	}

	function setUniforms(){
		gl.uniformMatrix4fv( Uniforms.CameraMatrix, gl.FALSE,flatten(mult(P,Mcam)));
		gl.uniform3fv(Uniforms.CameraPosition, flatten(eye));
	}

	function cameraMatrix(eye, at, up){
	  var w = normalize(subtract(eye,at));
	  var u = cross(up, w);
	  var v = cross(w,u);
	  return mat4( vec4(u, -dot(u,eye)),
				vec4(v, -dot(v,eye)),
				vec4(w, -dot(w,eye)),
				vec4(0,0,0,1)
			);
	}

	function orthoProjMatrix(r,l,t,b,n,f){ // n and f should be -ve

		return mat4(2/(r-l), 0, 0, -(r+l)/(r-l),
					0, 2/(t-b), 0, -(t+b)/(t-b),
					0, 0, 2/(n-f), -(n+f)/(n-f),
					0, 0, 0, 1);

	}

	function perspProjectionMatrix(r,l,t,b,n,f){ // n and f should be -ve

		return mat4(-2*n/(r-l), 0, (r+l)/(r-l), 0,
					0, -2*n/(t-b),(t+b)/(t-b), 0,
					0, 0, -(n+f)/(n-f), 2*f*n/(n-f),
					0, 0, -1, 0 );
	}

	function perspectiveMatrix(fovy, aspect, near, far ){ // near and far are +ve
		var t = near*Math.tan(radians(fovy/2));
		var r = t*aspect;
		return perspProjectionMatrix(r,-r, t,-t, -near, -far);
	}

	return C;
}

//--------------- GET UNIFORM AND ATTRIBUTE LOCATIONS -------------

function getAttributeLocations(){
  var A = {};
  var l = arguments.length;
  for(var i=0;i<l;++i){
  	var name = arguments[i];
  	var loc = gl.getAttribLocation(program, name);
	gl.enableVertexAttribArray(loc);
	A[name] = loc;
  }
  return A;
}

function getUniformLocations(){
 var U = {};
  var l = arguments.length;
  for(var i=0;i<l;++i){
  	var name = arguments[i];
	U[name] = gl.getUniformLocation(program, name);
  }
  return U;
}

//--------------------- LIGHT -------------------------------
function Light(){
	var L = {};
	L.setPosition = function(position){
		gl.uniform3fv( Uniforms.LightPosition, flatten(position) );
	};
	L.setParameters = function(Ia, Id, Is){
		gl.uniform3fv( Uniforms.Ia, flatten(Ia) );
		gl.uniform3fv( Uniforms.Id, flatten(Id) );
		gl.uniform3fv( Uniforms.Is, flatten(Is) );
	}

	// set defaults
	L.setPosition(vec3(0,3,5));
	L.setParameters(vec3(0.3, 0.3, 0.3), vec3(1,1,1), vec3(1,1,1) );
	
	return L;
}

