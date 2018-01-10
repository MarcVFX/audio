'use strict'

const Audio = require('../')
const t = require('tape')
const AudioBuffer = require('audio-buffer')
const db = require('decibels')
const lena = require('audio-lena')
const isBrowser = require('is-browser')
const path = require('path')
const fs = require('fs')
const AudioBufferList = require('audio-buffer-list')
const util = require('audio-buffer-utils')
const createOscillator = require('audio-oscillator')
const isAudioBuffer = require('is-audio-buffer')
const createBuffer = require('audio-buffer-from')


function f32(v) {
	if (v.length) return new Float32Array(v)

	return new Float32Array([v])[0]
}


t('read', t => {
	let saw = Array.from({length: 10}, (v, i) => i / 10)

	let a = Audio.from([saw, saw, saw])
	t.equal(a.length, 10)
	t.equal(a.channels, 3)

	let data

	data = a.read({channel: 1})
	t.deepEqual(data, new Float32Array([0,.1,.2,.3,.4,.5,.6,.7,.8,.9]))

	data = a.read({format: 'audiobuffer'})
	t.ok(isAudioBuffer(data))
	t.equal(data.length, 10)
	t.equal(data.numberOfChannels, 3)
	t.deepEqual(data.getChannelData(1), new Float32Array([0,.1,.2,.3,.4,.5,.6,.7,.8,.9]))

	data = a.read({channel: 1})
	t.equal(data.length, 10)
	t.ok(Array.isArray(data))
	t.deepEqual(data, new Float32Array([0,.1,.2,.3,.4,.5,.6,.7,.8,.9]))

	data = a.read({channel: 0, dtype: 'uint8'})
	t.equal(data.length, 10)
	t.ok(ArrayBuffer.isView(data))
	t.deepEqual(data, [127, 140, 153, 165, 178, 191, 204, 216, 229, 242])

	data = a.read(2/44100, 8/44100, {})
	t.equal(data[0].length, 8)
	t.deepEqual(data[0], new Float32Array([.2,.3,.4,.5,.6,.7,.8,.9]))

	t.throws(() => {
		a.read(new Uint8Array(10), {channel: 0})
	})

	data = a.read({dest: new Uint8Array(10), channel: 0})
	t.deepEqual(data, [127, 140, 153, 165, 178, 191, 204, 216, 229, 242])

	data = a.read(a.time(5), { dst: new Float32Array(15)})
	t.deepEqual(data, new Float32Array([.5,.6,.7,.8,.9,.5,.6,.7,.8,.9,.5,.6,.7,.8,.9]))

	data = a.read(a.time(5), a.time(1), {dst: new Int8Array(3).buffer, format: 'int8'})
	t.deepEqual(new Int8Array(data), [63, 63, 63])

	data = a.read(a.time(6), a.time(2), {format: 'float32 interleaved', channels: [1, 2]})
	t.deepEqual(data, new Float32Array([.6, .6, .7, .7]))


	let silence = Audio({length: 10})
	t.throws(() => {
		silence.read({channel: 1})
	})


	// ex-read test
	let audio = new Audio(1, 2)

	t.deepEqual(audio.read(-100/audio.sampleRate)[0].length, 100)

	t.deepEqual(audio.read({channel: 1}).length, audio.sampleRate)

	let audio3 = Audio([0, .1, 0, .2, 0, .3], 3)
	t.deepEqual(audio3.read(),
		[new Float32Array([0, .1]), new Float32Array([0, .2]), new Float32Array([0, .3])])

	t.end()
})


t('write', t => {
	let a = new Audio(10/44100, 3)
	let d

	a.write([[0,.5,1], new Float32Array([0, -.5, -1])])
	t.deepEqual(a.read({channel: 0}), [0,.5,1, 0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 1}), [0,-.5,-1, 0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 2}), [0,0,0, 0,0,0,0,0,0,0])

	a.write(createBuffer(4, 2), 1/44100, 1/44100, {channels: [1,2]})
	t.deepEqual(a.read({channel: 0}), [0,.5,1, 0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 1}), [0,0,-1, 0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 2}), [0,0,0, 0,0,0,0,0,0,0])

	a.write(new Uint8Array([255,255,255]), {start: 8, channel: 2})
	t.deepEqual(a.read({channel: 0}), [0,.5,1, 0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 1}), [0,0,-1, 0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 2}), [0,0,0, 0,0,0,0,0,1,1])

	a.write(new AudioBufferList([-1,1]))
	t.deepEqual(a.read({channel: 0}), [-1,1,1, 0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 1}), [0,0,-1, 0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 2}), [0,0,0, 0,0,0,0,0,1,1])

	a.write(new Audio([-1,-1,-1,-1], 2), 5/44100, {channels: [0,2]})
	t.deepEqual(a.read({channel: 0}), [-1,1,1,0,0,-1,-1,0,0,0])
	t.deepEqual(a.read({channel: 1}), [0,0,-1,0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 2}), [0,0,0,0,0,-1,-1,0,1,1])

	t.end()
})

t('write value', t => {
	let audio = Audio([0, .1, .2, .3, .4, .5], 1)

	audio.write(1, 2/audio.sampleRate, 2/audio.sampleRate)

	t.deepEqual(audio.read(1/44100,4/44100)[0], f32([.1,1,1,.4]))

	t.end()
})

t('write function', t => {
	let a = Audio({length: 441}).write(1)

	t.equal(a.length, 441)
	t.equal(a.duration, .01)
	t.deepEqual(a.read({channel: 0}), Array.from({length: 441}, x => 1))

	let _i = 0;
	a.write((v, i, ch) => {
		t.equal(i, _i)
		_i++

		return v * .5
	})

	t.end()
})


t('insert', t => {
	let a = new Audio(7/44100, 3)
	let d

	a.insert([[0,.5,1], new Float32Array([0, -.5, -1])], 0)
	t.deepEqual(a.read({channel: 0}), [0,.5,1, 0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 1}), [0,-.5,-1, 0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 2}), [0,0,0, 0,0,0,0,0,0,0])

	a.insert(createBuffer(2, 2), 1/44100, 1/44100, {channels: [1,2]})
	t.deepEqual(a.read({channel: 0}), [0,0,0,.5,1, 0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 1}), [0,0,0,-.5,-1, 0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 2}), [0,0,0,0,0, 0,0,0,0,0,0,0])

	a.insert(new Uint8Array([255,255,255]), {channel: 2})
	t.deepEqual(a.read({channel: 0}), [0,0,0,.5,1, 0,0,0,0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 1}), [0,0,0,-.5,-1, 0,0,0,0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 2}), [0,0,0,0,0, 0,0,0,0,0,0,0,1,1,1])

	a.insert(new AudioBufferList([-1,1]))
	t.deepEqual(a.read({channel: 0}), [0,0,0,.5,1, 0,0,0,0,0,0,0,0,0,0,-1,1])
	t.deepEqual(a.read({channel: 1}), [0,0,0,-.5,-1, 0,0,0,0,0,0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 2}), [0,0,0,0,0, 0,0,0,0,0,0,0,1,1,1,0,0])

	a.insert(new Audio([-1,-1,-1,-1], 2), 5/44100, {channels: [0,2]})
	t.deepEqual(a.read({channel: 0}), [0,0,0,.5,1, -1,-1, 0,0,0,0,0,0,0,0,0,0,-1,1])
	t.deepEqual(a.read({channel: 1}), [0,0,0,-.5,-1, 0,0, 0,0,0,0,0,0,0,0,0,0,0,0])
	t.deepEqual(a.read({channel: 2}), [0,0,0,0,0, -1,-1, 0,0,0,0,0,0,0,1,1,1,0,0])

	t.end()
})


t('remove', t => {
	let a = Audio([0, .1, .2, .3, .4], 1)

	let frag = a.remove(a.time(1), a.time(1), {keep: true})

	t.deepEqual(a.read({channel: 0}), f32([0, .2, .3, .4]))
	t.deepEqual(frag.read({channel: 0}), f32([.1]))

	let frag2 = a.remove(a.time(2), a.time(1))

	t.deepEqual(a.read({channel: 0}), f32([0, .2, .4]))
	t.equal(frag2, a)

	t.end()
})


t('slice', t => {
	let a = Audio([0, .1, .2, .3, .4])

	let frag1 = a.slice(a.time(1), a.time(4), {copy: false})
	t.deepEqual(a.read({channel: 0}), f32([.1, .2, .3, .4]))
	t.equal(frag1, a)

	let frag2 = a.slice(a.time(0), a.time(1))
	t.deepEqual(a.read({channel: 0}), f32([.1, .2, .3, .4]))
	t.notEqual(frag2, a)
	t.deepEqual(frag2.read({channel: 0}), f32([.1]))

	let dup = a.slice()
	t.ok(Audio.equal(a, dup))
	t.notEqual(dup, a)

	t.end()
})


t('trim', t => {
	let audio = new Audio([0,0,0,.1,.2,-.1,-.2,0,0], 1).trim()

	t.deepEqual(audio.read({channel: 0}), new Float32Array([.1,.2,-.1,-.2]))


	//trim samples from the beginning below -30 db
	audio = Audio([0.0001, 0, .1, .2, 0], 1).trim({threshold: -30, left: true})

	t.deepEqual(audio.read({channel: 0}), new Float32Array([.1, .2, 0]))

	//remove samples below .02 from the end
	audio = Audio([0, .1, .2, -.1, -.2, 0, .0001], 1).trim({threshold: Audio.db(.02), left: false})

	t.deepEqual(audio.read()[0], new Float32Array([0, .1, .2, -.1, -.2]))

	t.end();
})


t('pad', t => {
	let a = Audio(.005, 2)

	t.equal(a.length, 221)

	a.pad(.01)

	t.equal(a.duration, .01)
	t.equal(a.length, 441)

	a.write(1)

	//pad right
	a.pad(.015, .5)
	t.deepEqual(a.read(.01, a.time(2))[0], [.5,.5])

	//pad left
	a.pad(.02, {value: .1, left: true})
	t.deepEqual(a.read(.0, a.time(2))[0], f32([.1,.1]))

	t.end()
})


t('shift', t => {
	let a = Audio([0, .25, .5, .75, 1])

	a.shift(-a.time(2))
	t.deepEqual(a.read({channel: 0}), [.5, .75, 1, 0, 0])

	a.shift(a.time(3))
	t.deepEqual(a.read({channel: 0}), [0, 0, 0, .5, .75])

	a.shift(a.time(10))
	t.deepEqual(a.read({channel: 0}), [0, 0, 0, 0, 0])


	a.write([0, .25, .5, .75, 1])

	a.shift(-a.time(2), {rotate: true})
	t.deepEqual(a.read({channel: 0}), [.5, .75, 1, 0, .25])

	a.shift(a.time(3), {rotate: true})
	t.deepEqual(a.read({channel: 0}), [1, 0, 0.25, .5, .75])

	t.end()
})

t.skip('shift channels')


t.skip('stream', t => {
	// let a = Audio(MediaInput, a => {

	// })

	t.end()
})

t.skip('sync sequence', t => {
	t.end()
})

t.skip('mixed sequence', t => {
	t.end()
})

t('normalize', t => {
	//full normalize
	let audio = Audio([0, .1, 0, -.1], {channels: 1})

	audio.normalize()
	t.deepEqual(audio.read({channel: 0}), [0, 1, 0, -1]);

	//partial normalize
	let audio2 = Audio([0, .1, 0, -.1], {channels: 1})
	audio2.normalize(2/audio2.sampleRate)
	t.deepEqual(audio2.read()[0], new Float32Array([0, .1, 0, -1]));

	//partial channels
	let audio3 = Audio([0, .1, 0, .2, 0, .3], 3)
	audio3.normalize({channel: [0, 1]})
	t.deepEqual(audio3.read({channel: [0, 1]}), [[0, .5], [0, 1]])

	t.end();
})

t('fade', t => {
	let audio = Audio(Array(100).fill(1), {channels: 1})

	let inCurve = Array(10).fill(1).map((v, i) => (i + .5)/10).map(v => db.toGain(v*40 - 40))
	let outCurve = inCurve.slice().reverse()

	//fade in
	audio.fade(10/audio.sampleRate)
	t.deepEqual(audio.read(0, 10/audio.sampleRate)[0], new Float32Array(inCurve))

	//fade out
	// audio.fade(-10/audio.sampleRate)
	// t.deepEqual(audio.read(-10/44100)[0], new Float32Array(outCurve))

	t.end();
})

t('gain', t => {
	let audio = new Audio(f32(Array(441).fill(1))).gain(-20)

	// t.equal(audio.read({channel: 0})[10], .1)
	t.deepEqual(audio.read({channel: 0}), f32(Array(441).fill(Audio.gain(-20))))

	t.end()
})

t('reverse', t => {
	let data = Array(10).fill(1).map((v, i) => (.5 + i)/10)
	let fixture = new Float32Array(data.slice().reverse())

	let audio = new Audio([data, data])

	audio.reverse()

	t.deepEqual(audio.read({channel: 0}), fixture)

	audio.reverse(1/44100, 1/44100, {channel: 1})

	t.deepEqual(audio.read(1/44100, 1/44100)[0], new Float32Array(fixture.slice(1, 2)))
	t.deepEqual(audio.read(1/44100, 1/44100)[1], new Float32Array(data.slice(8, 9)))

	t.end()
})


t('invert', t => {
	let data = Array(1000).fill(1).map((v, i) => (.5 + i)/1000)
	let fixture = Array(1000).fill(1).map((v, i) => -(.5 + i)/1000)

	let audio = new Audio(data, 1)

	audio.invert()

	t.deepEqual(audio.read()[0], new Float32Array(fixture))

	audio.invert(10/44100, 10/44100)

	t.deepEqual(audio.read(10/44100, 10/44100)[0], new Float32Array(data.slice(10, 20)))

	t.end()
})

t.skip('Write stream', t => {
	let source = createSource(lena);

	let a = Audio();

	a.write(source, (err, a) => {

	});

	t.end()
});

t.skip('End writing', t => {
	let gen = Gen((t) => {
		return Math.sin(t*440*Math.PI*2)
	});
	let through = Through((chunk, done) => {
		setTimeout(() => done(chunk), 200)
	});

	a.write()
	a.end();
});



t.skip('save', t => {
	let a = Audio(lena, (err, a) => {
		a.save('lena.wav', (err, a) => {
			if (!isBrowser) {
				let p = __dirname + path.sep + 'lena.wav'
				t.ok(fs.existsSync(p))
				fs.unlinkSync(p);
			}
			t.end()
		})
	})
})



t.skip('periodic', t => {
	let audio = Audio({length: 8})

	audio.periodic('saw', {from: 2, to: 6, frequency: 44100})

	t.deepEqual(audio.toArray(), [])
})


t('through', t => {
	let a = Audio([1, 1])

	a.through(buf => {
		util.fill(buf, 1)
	}, {from: .5, to: 1.5})

	// t.equal(a.read(0, 1), )

	t.end()
})
