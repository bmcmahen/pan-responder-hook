import * as React from "react";

/**
 * The pan responder takes its inspiration from react-native's
 * pan-responder, and react-spring. Learn more about react-native's
 * system here:
 *
 * https://facebook.github.io/react-native/docs/gesture-responder-system.html
 *
 * Basic usage:
 *
 * const bind = usePanResponder({
 *  onStartShouldSet: () => true,
 *  onGrant: () => highlight(),
 *  onMove: () => updatePosition(),
 *  onRelease: () => unhighlight(),
 *  onTerminate: () => unhighlight()
 * })
 *
 * The main benefit this provides is the ability to reconcile
 * multiple gestures, and give priority to one.
 *
 * You can use a combination of useStartShouldSet, useStartShouldSetCapture,
 * onMoveShouldSetCapture, and onMoveShouldSet to dictate
 * which gets priority.
 *
 * Typically you'd want to avoid capture since it's generally
 * preferable to have child elements gain touch access.
 */

export type ResponderEvent = React.TouchEvent | React.MouseEvent | Event;
export type CallbackQueryType = (
  state: StateType,
  e: ResponderEvent
) => boolean;
export type CallbackType = (state: StateType, e: ResponderEvent) => void;

export interface Callbacks {
  onStartShouldSetCapture?: CallbackQueryType;
  onStartShouldSet?: CallbackQueryType;
  onMoveShouldSetCapture?: CallbackQueryType;
  onMoveShouldSet?: CallbackQueryType;
  onGrant?: CallbackType;
  onMove?: CallbackType;
  onRelease?: CallbackType;
  onTerminate?: (state: StateType, e?: ResponderEvent) => void;
}

const initialState = {
  time: Date.now(),
  xy: [0, 0],
  delta: [0, 0],
  initial: [0, 0],
  previous: [0, 0],
  direction: [0, 0],
  local: [0, 0],
  lastLocal: [0, 0],
  velocity: 0,
  distance: 0,
  first: true
};

export type StateType = typeof initialState;

interface Config {
  uid?: string;
  enableMouse?: boolean;
}

const defaultConfig: Config = {
  enableMouse: true
};

export interface GrantedTouch {
  id: string | number;
  onTerminate: (e?: ResponderEvent) => void;
}

let grantedTouch: GrantedTouch | null = null;

export function usePanResponder(options: Callbacks = {}, config: Config = {}) {
  const state = React.useRef(initialState);

  const { uid, enableMouse } = {
    ...defaultConfig,
    ...config
  };
  const id = React.useRef(uid || Math.random());
  const [pressed, setPressed] = React.useState(false);

  // update our callbacks when they change
  const callbackRefs = React.useRef(options);
  React.useEffect(() => {
    callbackRefs.current = options;
  }, [options]);

  /**
   * Attempt to claim the active touch
   */

  function claimTouch(e: ResponderEvent) {
    if (grantedTouch) {
      grantedTouch.onTerminate(e);
      grantedTouch = null;
    }

    attemptGrant(e);
  }

  /**
   * Attempt to claim the active touch
   * @param e
   */

  function attemptGrant(e: ResponderEvent) {
    // if a touch is already active we won't register
    if (grantedTouch) {
      return;
    }

    grantedTouch = {
      id: id.current,
      onTerminate
    };

    state.current = {
      ...state.current,
      first: true
    };

    onGrant(e);
  }

  function handleStartCapture(e: ResponderEvent) {
    setPressed(true);

    const granted = onStartShouldSetCapture(e);
    if (granted) {
      attemptGrant(e);
    }
  }

  function handleStart(e: ResponderEvent) {
    setPressed(true);

    if (e.cancelable) {
      e.preventDefault();
    }

    const granted = onStartShouldSet(e);

    if (granted) {
      attemptGrant(e);
    }
  }

  function isGrantedTouch() {
    return grantedTouch && grantedTouch.id === id.current;
  }

  /**
   * Handle touchend / mouseup events
   * @param e
   */

  function handleEnd(e: ResponderEvent) {
    setPressed(false);

    if (!isGrantedTouch()) {
      return;
    }

    // remove touch
    grantedTouch = null;

    state.current = {
      ...state.current,
      first: false
    };

    if (e.cancelable) {
      e.preventDefault();
    }

    onRelease(e);
  }

  /**
   * Handle touchmove / mousemove capture events
   * @param e
   */

  function handleMoveCapture(e: ResponderEvent) {
    if (!isGrantedTouch()) {
      const grant = onMoveShouldSetCapture(e);
      if (grant) claimTouch(e);
      else return;
    }

    onMove(e);
  }

  /**
   * Handle touchmove / mousemove events
   * @param e
   */

  function handleMove(e: ResponderEvent) {
    if (!isGrantedTouch()) {
      if (onMoveShouldSet(e)) {
        claimTouch(e);
      } else {
        return;
      }
    }

    onMove(e);
  }

  /**
   * When our gesture starts, should we become the responder?
   */

  function onStartShouldSet(e: ResponderEvent) {
    return callbackRefs.current.onStartShouldSet
      ? callbackRefs.current.onStartShouldSet(state.current, e)
      : false;
  }

  /**
   * Same as onStartShouldSet, except using capture.
   */

  function onStartShouldSetCapture(e: ResponderEvent) {
    return callbackRefs.current.onStartShouldSetCapture
      ? callbackRefs.current.onStartShouldSetCapture(state.current, e)
      : false;
  }

  /**
   * When our gesture moves, should we become the responder?
   */

  function onMoveShouldSet(e: ResponderEvent) {
    return callbackRefs.current.onMoveShouldSet
      ? callbackRefs.current.onMoveShouldSet(state.current, e)
      : false;
  }

  /**
   * Same as onMoveShouldSet, but using capture instead
   * of bubbling.
   */

  function onMoveShouldSetCapture(e: ResponderEvent) {
    return callbackRefs.current.onMoveShouldSetCapture
      ? callbackRefs.current.onMoveShouldSetCapture(state.current, e)
      : false;
  }

  /**
   * The view is responding to gestures. Typically corresponds
   * with mousedown or touchstart.
   * @param e
   */

  function onGrant(e: any) {
    const { pageX, pageY } = e.touches && e.touches[0] ? e.touches[0] : e;
    const s = state.current;
    state.current = {
      ...state.current,
      lastLocal: s.lastLocal || initialState.lastLocal,
      xy: [pageX, pageY],
      initial: [pageX, pageY],
      previous: [pageX, pageY],
      time: Date.now()
    };
    if (callbackRefs.current.onGrant) {
      callbackRefs.current.onGrant(state.current, e);
    }
  }

  /**
   * The user is moving their touch / mouse. Most of the math here
   * is from react-with-gesture.
   * @param e
   */

  function onMove(e: any) {
    const { pageX, pageY } = e.touches && e.touches[0] ? e.touches[0] : e;
    const s = state.current;
    const time = Date.now();
    const x_dist = pageX - s.xy[0];
    const y_dist = pageY - s.xy[1];
    const delta_x = pageX - s.initial[0];
    const delta_y = pageY - s.initial[1];
    const distance = Math.sqrt(delta_x * delta_x + delta_y * delta_y);
    const len = Math.sqrt(x_dist * x_dist + y_dist * y_dist);
    const scaler = 1 / (len || 1);
    const velocity = len / (time - s.time);

    state.current = {
      ...state.current,
      time,
      xy: [pageX, pageY],
      delta: [delta_x, delta_y],
      local: [
        s.lastLocal[0] + pageX - s.initial[0],
        s.lastLocal[1] + pageY - s.initial[1]
      ],
      velocity: time - s.time === 0 ? s.velocity : velocity,
      distance,
      direction: [x_dist * scaler, y_dist * scaler],
      previous: s.xy,
      first: false
    };

    if (callbackRefs.current.onMove) {
      callbackRefs.current.onMove(state.current, e);
    }
  }

  /**
   * The responder has been released. Typically mouse-up or
   * touchend events.
   * @param e
   */

  function onRelease(e: ResponderEvent) {
    const s = state.current;
    state.current = {
      ...state.current,
      lastLocal: s.local
    };

    if (callbackRefs.current.onRelease) {
      callbackRefs.current.onRelease(state.current, e);
    }
  }

  /**
   * The responder has been taken by another view
   */

  function onTerminate(e?: ResponderEvent) {
    const s = state.current;
    state.current = {
      ...state.current,
      lastLocal: s.local
    };

    if (callbackRefs.current.onTerminate) {
      callbackRefs.current.onTerminate(state.current, e);
    }
  }

  /**
   * Use window mousemove events instead of binding to the
   * element itself to better emulate how touchmove works.
   */

  React.useEffect(() => {
    if (pressed && enableMouse) {
      window.addEventListener("mousemove", handleMove, false);
      window.addEventListener("mousemove", handleMoveCapture, true);
      window.addEventListener("mouseup", handleEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleMove, false);
      window.removeEventListener("mousemove", handleMoveCapture, true);
      window.removeEventListener("mouseup", handleEnd);
    };
  }, [pressed, enableMouse]);

  /**
   * Imperatively terminate the current responder
   */

  function terminateCurrentResponder() {
    if (grantedTouch) {
      grantedTouch.onTerminate();
      grantedTouch = null;
    }
  }

  /**
   * A getter for returning the current
   * responder, if it exists
   */

  function getCurrentResponder() {
    return grantedTouch;
  }

  /**
   * Required touch / mouse events
   */

  const touchEvents = {
    onTouchStart: handleStart,
    onTouchEnd: handleEnd,
    onTouchMove: handleMove,
    onTouchStartCapture: handleStartCapture,
    onTouchMoveCapture: handleMoveCapture
  };

  const mouseEvents = enableMouse
    ? {
        onMouseDown: handleStart,
        onMouseDownCapture: handleStartCapture
      }
    : {};

  return {
    bind: {
      ...touchEvents,
      ...mouseEvents
    },
    terminateCurrentResponder,
    getCurrentResponder
  };
}
