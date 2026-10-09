import type { Mix } from './types';

// Two real mixes from the repository, for stories and component tests.
export const MIXES: Mix[] = [
	{
		uri: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/fm.plyr.track/3muhqykl7gz22',
		title: "one shot: I promise it's techno",
		artist: 'tierney cyren',
		sources: ['https://audio.plyr.fm/audio/9ecea76b87d5f0b7.wav'],
		mimeType: 'audio/wav',
		format: 'WAV',
		duration: 1335,
		image: 'https://images.plyr.fm/images/3b7c2b2a9a66b36b.jpeg',
		date: '2026-09-01T15:40:29.655455Z',
		description:
			"i'm doing one shot recordings: I get 20 minutes to make a mix, and I upload it no matter what\n\nthis one's techno, I promise"
	},
	{
		uri: 'at://did:plc:uashgn65n5z7aqwk5cbuba5c/fm.plyr.track/3mtwvgi6wzm22',
		title: 'tierney cyren @ tachycardia 028',
		artist: 'tierney cyren',
		sources: ['https://audio.plyr.fm/audio/fab218d0f30dcfab.mp3'],
		mimeType: 'audio/mpeg',
		format: 'MP3',
		duration: 3430,
		image: 'https://images.plyr.fm/images/612106687040f7f8.png',
		date: '2026-08-25T23:53:12.562753Z',
		description: ''
	}
];
