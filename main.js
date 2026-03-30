import { mat4 } from 'https://unpkg.com/wgpu-matrix@3.0.0/dist/3.x/wgpu-matrix.module.js';

const cubeVertexSize = 4 * 10;
const cubePositionOffset = 0;
const cubeUVOffset = 4 * 8;
const cubeVertexCount = 36;

const cubeVertexArray = new Float32Array([
	// float4 position, float4 color, float2 uv,
	1, -1, 1, 1,   1, 0, 1, 1,  0, 1,
	-1, -1, 1, 1,  0, 0, 1, 1,  1, 1,
	-1, -1, -1, 1, 0, 0, 0, 1,  1, 0,
	1, -1, -1, 1,  1, 0, 0, 1,  0, 0,
	1, -1, 1, 1,   1, 0, 1, 1,  0, 1,
	-1, -1, -1, 1, 0, 0, 0, 1,  1, 0,

	1, 1, 1, 1,    1, 1, 1, 1,  0, 1,
	1, -1, 1, 1,   1, 0, 1, 1,  1, 1,
	1, -1, -1, 1,  1, 0, 0, 1,  1, 0,
	1, 1, -1, 1,   1, 1, 0, 1,  0, 0,
	1, 1, 1, 1,    1, 1, 1, 1,  0, 1,
	1, -1, -1, 1,  1, 0, 0, 1,  1, 0,

	-1, 1, 1, 1,   0, 1, 1, 1,  0, 1,
	1, 1, 1, 1,    1, 1, 1, 1,  1, 1,
	1, 1, -1, 1,   1, 1, 0, 1,  1, 0,
	-1, 1, -1, 1,  0, 1, 0, 1,  0, 0,
	-1, 1, 1, 1,   0, 1, 1, 1,  0, 1,
	1, 1, -1, 1,   1, 1, 0, 1,  1, 0,

	-1, -1, 1, 1,  0, 0, 1, 1,  0, 1,
	-1, 1, 1, 1,   0, 1, 1, 1,  1, 1,
	-1, 1, -1, 1,  0, 1, 0, 1,  1, 0,
	-1, -1, -1, 1, 0, 0, 0, 1,  0, 0,
	-1, -1, 1, 1,  0, 0, 1, 1,  0, 1,
	-1, 1, -1, 1,  0, 1, 0, 1,  1, 0,

	1, 1, 1, 1,    1, 1, 1, 1,  0, 1,
	-1, 1, 1, 1,   0, 1, 1, 1,  1, 1,
	-1, -1, 1, 1,  0, 0, 1, 1,  1, 0,
	-1, -1, 1, 1,  0, 0, 1, 1,  1, 0,
	1, -1, 1, 1,   1, 0, 1, 1,  0, 0,
	1, 1, 1, 1,    1, 1, 1, 1,  0, 1,

	1, -1, -1, 1,  1, 0, 0, 1,  0, 1,
	-1, -1, -1, 1, 0, 0, 0, 1,  1, 1,
	-1, 1, -1, 1,  0, 1, 0, 1,  1, 0,
	1, 1, -1, 1,   1, 1, 0, 1,  0, 0,
	1, -1, -1, 1,  1, 0, 0, 1,  0, 1,
	-1, 1, -1, 1,  0, 1, 0, 1,  1, 0,
]);

const basicVertWGSL = `
struct Uniforms {
	modelViewProjectionMatrix : mat4x4f,
}
@binding(0) @group(0) var<uniform> uniforms : Uniforms;

struct VertexOutput {
	@builtin(position) Position : vec4f,
	@location(0) fragUV : vec2f,
	@location(1) fragPosition: vec4f,
}

@vertex
fn main(
	@location(0) position : vec4f,
	@location(1) uv : vec2f
) -> VertexOutput {
	var output : VertexOutput;
	output.Position = uniforms.modelViewProjectionMatrix * position;
	output.fragUV = uv;
	output.fragPosition = 0.5 * (position + vec4(1.0, 1.0, 1.0, 1.0));
	return output;
}
`;

const vertexPositionColorWGSL = `
@fragment
fn main(
	@location(0) fragUV: vec2f,
	@location(1) fragPosition: vec4f
) -> @location(0) vec4f {
	return fragPosition;
}
`;

async function init() {
	// Các biến điều khiển chuyển động
	let cubePosition = { x: 0, y: 0 };
	let cubeVelocity = { x: 0.02, y: 0.015 }; // Tốc độ di chuyển
	const cubeRadius = 1.0; // Dựa trên dữ liệu đỉnh từ -1 đến 1

	if (!navigator.gpu) {
		throw new Error("WebGPU not supported on this browser.");
	}

	const adapter = await navigator.gpu.requestAdapter();
	if (!adapter) {
		throw new Error("No appropriate GPUAdapter found.");
	}

	const device = await adapter.requestDevice();

	const canvas = document.querySelector('canvas');
	const context = canvas.getContext('webgpu');

	const devicePixelRatio = window.devicePixelRatio || 1;
	canvas.width = canvas.clientWidth * devicePixelRatio;
	canvas.height = canvas.clientHeight * devicePixelRatio;
	const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

	context.configure({
		device,
		format: presentationFormat,
		alphaMode: 'premultiplied',
	});

	// Create a vertex buffer from the cube data.
	const verticesBuffer = device.createBuffer({
		size: cubeVertexArray.byteLength,
		usage: GPUBufferUsage.VERTEX,
		mappedAtCreation: true,
	});
	new Float32Array(verticesBuffer.getMappedRange()).set(cubeVertexArray);
	verticesBuffer.unmap();

	const pipeline = device.createRenderPipeline({
		layout: 'auto',
		vertex: {
			module: device.createShaderModule({
				code: basicVertWGSL,
			}),
			buffers: [
				{
					arrayStride: cubeVertexSize,
					attributes: [
						{
							// position
							shaderLocation: 0,
							offset: cubePositionOffset,
							format: 'float32x4',
						},
						{
							// uv
							shaderLocation: 1,
							offset: cubeUVOffset,
							format: 'float32x2',
						},
					],
				},
			],
		},
		fragment: {
			module: device.createShaderModule({
				code: vertexPositionColorWGSL,
			}),
			targets: [
				{
					format: presentationFormat,
				},
			],
		},
		primitive: {
			topology: 'triangle-list',
			cullMode: 'back',
		},
		depthStencil: {
			depthWriteEnabled: true,
			depthCompare: 'less',
			format: 'depth24plus',
		},
	});

	const depthTexture = device.createTexture({
		size: [canvas.width, canvas.height],
		format: 'depth24plus',
		usage: GPUTextureUsage.RENDER_ATTACHMENT,
	});

	const uniformBufferSize = 4 * 16; // 4x4 matrix
	const uniformBuffer = device.createBuffer({
		size: uniformBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	const uniformBindGroup = device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [{ binding: 0, resource: uniformBuffer }],
	});

	const renderPassDescriptor = {
		colorAttachments: [
			{
				view: undefined, // Assigned later
				clearValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
				loadOp: 'clear',
				storeOp: 'store',
			},
		],
		depthStencilAttachment: {
			view: depthTexture.createView(),
			depthClearValue: 1.0,
			depthLoadOp: 'clear',
			depthStoreOp: 'store',
		},
	};

	const aspect = canvas.width / canvas.height;
	const projectionMatrix = mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0);
	const modelViewProjectionMatrix = mat4.create();

	function getTransformationMatrix() {
		const now = Date.now() / 1000;
		
		// 1. Tính toán View Matrix (Camera cố định ở z = -4)
		const viewMatrix = mat4.identity();
		mat4.translate(viewMatrix, [0, 0, -4], viewMatrix);
	
		// 2. Tính toán Model Matrix (Di chuyển và Xoay)
		const modelMatrix = mat4.identity();
		// Di chuyển khối lập phương tới vị trí hiện tại
		mat4.translate(modelMatrix, [cubePosition.x, cubePosition.y, 0], modelMatrix);
		// Xoay khối lập phương
		mat4.rotate(modelMatrix, [Math.sin(now), Math.cos(now), 0], 1, modelMatrix);
	
		// 3. Kết hợp: Projection * View * Model
		mat4.multiply(projectionMatrix, viewMatrix, modelViewProjectionMatrix);
		mat4.multiply(modelViewProjectionMatrix, modelMatrix, modelViewProjectionMatrix);
	
		return modelViewProjectionMatrix;
	}

	function frame() {
		// Tính toán giới hạn biên (Frustum) tại khoảng cách z = 4
		// fov = (2 * Math.PI) / 5
		const fov = (2 * Math.PI) / 5;
		const visibleHeight = 2 * Math.tan(fov / 2) * 4;
		const visibleWidth = visibleHeight * aspect;

		const boundaryX = visibleWidth / 2 - cubeRadius;
		const boundaryY = visibleHeight / 2 - cubeRadius;

		// Cập nhật vị trí
		cubePosition.x += cubeVelocity.x;
		cubePosition.y += cubeVelocity.y;

		// Kiểm tra va chạm cạnh trái/phải
		if (cubePosition.x > boundaryX || cubePosition.x < -boundaryX) {
			cubeVelocity.x *= -1; // Đảo hướng
			cubePosition.x = Math.sign(cubePosition.x) * boundaryX; // Tránh bị kẹt ở biên
		}

		// Kiểm tra va chạm cạnh trên/dưới
		if (cubePosition.y > boundaryY || cubePosition.y < -boundaryY) {
			cubeVelocity.y *= -1; // Đảo hướng
			cubePosition.y = Math.sign(cubePosition.y) * boundaryY; // Tránh bị kẹt ở biên
		}

		const transformationMatrix = getTransformationMatrix();
		device.queue.writeBuffer(
			uniformBuffer,
			0,
			transformationMatrix.buffer,
			transformationMatrix.byteOffset,
			transformationMatrix.byteLength
		);
		renderPassDescriptor.colorAttachments[0].view = context
			.getCurrentTexture()
			.createView();

		const commandEncoder = device.createCommandEncoder();
		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(pipeline);
		passEncoder.setBindGroup(0, uniformBindGroup);
		passEncoder.setVertexBuffer(0, verticesBuffer);
		passEncoder.draw(cubeVertexCount);
		passEncoder.end();
		device.queue.submit([commandEncoder.finish()]);

		requestAnimationFrame(frame);
	}

	requestAnimationFrame(frame);
}

init().catch(console.error);
