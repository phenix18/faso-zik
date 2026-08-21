import { createSlice } from "@reduxjs/toolkit";

/**
 * Etat du lecteur global. La file d'attente vit ici pour qu'un morceau lance
 * depuis n'importe quelle page continue pendant la navigation.
 */
const initialState = {
  queue: [],
  index: 0,
  current: null,
  isPlaying: false,
  isActive: false,
  volume: 0.9,
  muted: false,
  repeat: "off", // off | one | all
  shuffle: false,
  fullScreen: false,
  // Economie de donnees : definition la plus basse et prechargement reduit.
  // Relu depuis le navigateur au montage du lecteur.
  dataSaver: false,
  progress: { position: 0, duration: 0 },
};

const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    playTrack: (state, action) => {
      const { track, queue } = action.payload;
      if (Array.isArray(queue) && queue.length) {
        state.queue = queue;
        state.index = Math.max(
          queue.findIndex((item) => item.id === track.id),
          0,
        );
      } else {
        state.queue = [track];
        state.index = 0;
      }
      state.current = track;
      state.isActive = true;
      state.isPlaying = true;
      state.progress = { position: 0, duration: track.duration || 0 };
    },
    setQueue: (state, action) => {
      state.queue = action.payload;
    },
    enqueue: (state, action) => {
      state.queue.push(action.payload);
      state.isActive = true;
    },
    /** Saut direct a une position de la file, depuis le panneau d'attente. */
    jumpTo: (state, action) => {
      const index = action.payload;
      if (index < 0 || index >= state.queue.length) return;
      state.index = index;
      state.current = state.queue[index];
      state.isPlaying = true;
    },
    removeFromQueue: (state, action) => {
      const index = action.payload;
      if (index < 0 || index >= state.queue.length) return;

      state.queue.splice(index, 1);
      if (!state.queue.length) return;

      // Retirer un titre avant celui en cours decalerait la lecture : on
      // suit le morceau plutot que sa position.
      if (index < state.index) state.index -= 1;
      else if (index === state.index) {
        state.index = Math.min(state.index, state.queue.length - 1);
        state.current = state.queue[state.index];
      }
    },
    playPause: (state, action) => {
      state.isPlaying = action.payload ?? !state.isPlaying;
    },
    next: (state) => {
      if (!state.queue.length) return;
      if (state.shuffle) {
        state.index = Math.floor(Math.random() * state.queue.length);
      } else if (state.index < state.queue.length - 1) {
        state.index += 1;
      } else if (state.repeat === "all") {
        state.index = 0;
      } else {
        state.isPlaying = false;
        return;
      }
      state.current = state.queue[state.index];
      state.isPlaying = true;
    },
    previous: (state) => {
      if (!state.queue.length) return;
      state.index = state.index > 0 ? state.index - 1 : state.queue.length - 1;
      state.current = state.queue[state.index];
      state.isPlaying = true;
    },
    setVolume: (state, action) => {
      state.volume = action.payload;
      state.muted = action.payload === 0;
    },
    toggleMute: (state) => {
      state.muted = !state.muted;
    },
    cycleRepeat: (state) => {
      state.repeat = { off: "all", all: "one", one: "off" }[state.repeat];
    },
    toggleShuffle: (state) => {
      state.shuffle = !state.shuffle;
    },
    setFullScreen: (state, action) => {
      state.fullScreen = action.payload;
    },
    setDataSaver: (state, action) => {
      state.dataSaver = action.payload;
    },
    setProgress: (state, action) => {
      state.progress = action.payload;
    },
    closePlayer: (state) => ({ ...initialState, dataSaver: state.dataSaver }),
  },
});

export const {
  playTrack,
  setQueue,
  enqueue,
  jumpTo,
  removeFromQueue,
  playPause,
  next,
  previous,
  setVolume,
  toggleMute,
  cycleRepeat,
  toggleShuffle,
  setFullScreen,
  setDataSaver,
  setProgress,
  closePlayer,
} = playerSlice.actions;

export default playerSlice.reducer;
