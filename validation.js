import React, { useReducer, useEffect, createContext, useContext } from 'react'
import { decode } from 'rlp'
import dayjs from 'dayjs'
import { useLogger, useThunk, useInterval } from './lib'
import {
  fetchFlipHashes,
  fetchFlip,
  submitShortAnswers as submitShortAnswersApi,
  submitLongAnswers as submitLongAnswersApi,
} from './api'
import { useEpochState, useTimingState } from './epoch'

const _db = {
  epoch: 0,
  answers: [],
}
const db = global.validationDb || {
  getValidation() {
    return _db
  },
  resetValidation(epoch) {
    _db.epoch = epoch
  },
  setShortAnswers(payload, epoch) {
    _db.answers[0] = payload
    _db.epoch = epoch
  },
  setLongAnswers(payload, epoch) {
    _db.answers[1] = payload
    _db.epoch = epoch
  },
}

export const EpochPeriod = {
  FlipLottery: 'FlipLottery',
  ShortSession: 'ShortSession',
  LongSession: 'LongSession',
  AfterLongSession: 'AfterLongSession',
  None: 'None',
}

export const AnswerType = {
  None: 0,
  Left: 1,
  Right: 2,
  Inappropriate: 3,
}

export const SessionType = {
  Short: 'short',
  Long: 'long',
}

function fromHexString(hexString) {
  return new Uint8Array(
    hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  )
}

function reorderFlips(flips) {
  const ready = []
  const loading = []
  const failed = []
  const hidden = []
  for (let i = 0; i < flips.length; i++) {
    if (flips[i].hidden) {
      hidden.push(flips[i])
    } else if (flips[i].ready && flips[i].loaded) {
      ready.push(flips[i])
    } else if (flips[i].failed) {
      failed.push(flips[i])
    } else {
      loading.push(flips[i])
    }
  }
  return [...ready, ...loading, ...failed, ...hidden]
}

function decodeFlips(data, currentFlips) {
  const flips = currentFlips.length
    ? currentFlips
    : data.map(item => ({
        ...item,
        pics: null,
        urls: null,
        orders: null,
        answer: null,
        loaded: false,
      }))
  return flips.map(flip => {
    if ((flip.ready && flip.loaded) || flip.failed) {
      return flip
    }
    const item = data.find(x => x.hash === flip.hash)
    if (item.ready) {
      try {
        const decodedFlip = decode(fromHexString(item.hex.substring(2)))
        const pics = decodedFlip[0]
        const orders = decodedFlip[1].map(order => order.map(x => x[0] || 0))
        return {
          ...flip,
          ready: true,
          pics,
          orders,
          loaded: true,
          hidden: flip.hidden || item.hidden,
        }
      } catch {
        return {
          hash: flip.hash,
          failed: true,
          hidden: flip.hidden || item.hidden,
          ready: false,
          pics: null,
          orders: null,
          answer: null,
          loaded: false,
        }
      }
    }
    return {
      hash: item.hash,
      hidden: item.hidden,
      ready: item.ready,
    }
  })
}

export function hasAnswer(answer) {
  return Number.isFinite(answer)
}

function canSubmit(flips, idx) {
  const availableFlips = flips.filter(x => !x.hidden && !x.failed)
  const visibleFlips = flips.filter(x => !x.hidden)
  return (
    availableFlips.map(x => x.answer).every(hasAnswer) ||
    idx >= visibleFlips.length - 1
  )
}

const LOAD_VALIDATION = 'LOAD_VALIDATION'
const SUBMIT_SHORT_ANSWERS = 'SUBMIT_SHORT_ANSWERS'
const SUBMIT_LONG_ANSWERS = 'SUBMIT_LONG_ANSWERS'
const RESET_EPOCH = 'RESET_EPOCH'
export const START_FETCH_FLIPS = 'START_FETCH_FLIPS'
const FETCH_FLIPS_SUCCEEDED = 'FETCH_FLIPS_SUCCEEDED'
const FETCH_FLIPS_FAILED = 'FETCH_FLIPS_FAILED'
export const ANSWER = 'ANSWER'
export const NEXT = 'NEXT'
export const PREV = 'PREV'
export const PICK = 'PICK'
export const REPORT_ABUSE = 'REPORT_ABUSE'
export const SHOW_EXTRA_FLIPS = 'SHOW_EXTRA_FLIPS'

const initialCeremonyState = {
  flips: [],
  loading: true,
  currentIndex: 0,
  canSubmit: false,
  ready: false,
}

const initialState = {
  shortAnswers: [],
  longAnswers: [],
  epoch: null,
  shortAnswersSubmitted: false,
  longAnswersSubmitted: false,
  ...initialCeremonyState,
}

function validationReducer(state, action) {
  switch (action.type) {
    case LOAD_VALIDATION: {
      return { ...state, ...action.validation }
    }
    case SUBMIT_SHORT_ANSWERS: {
      return {
        ...state,
        shortAnswers: action.answers,
        epoch: action.epoch,
        shortAnswersSubmitted: true,
        ...initialCeremonyState,
      }
    }
    case SUBMIT_LONG_ANSWERS: {
      return {
        ...state,
        longAnswers: action.answers,
        epoch: action.epoch,
        longAnswersSubmitted: true,
        ...initialCeremonyState,
      }
    }
    case RESET_EPOCH: {
      return {
        ...state,
        shortAnswers: [],
        longAnswers: [],
        epoch: action.epoch,
        shortAnswersSubmitted: false,
        longAnswersSubmitted: false,
        ...initialCeremonyState,
      }
    }
    case START_FETCH_FLIPS: {
      return {
        ...state,
        loading: true,
      }
    }
    case FETCH_FLIPS_SUCCEEDED: {
      const { data, sessionType } = action
      let flips = decodeFlips(data, state.flips)
      const { currentIndex } = state
      if (sessionType === SessionType.Long) {
        flips = flips.map(flip => ({
          ...flip,
          hidden: !flip.ready,
        }))
      }
      flips = reorderFlips(flips)
      return {
        ...state,
        flips,
        currentIndex,
        loading: false,
        ready: flips.every(x => x.ready || x.failed),
      }
    }
    case FETCH_FLIPS_FAILED: {
      return {
        ...state,
        loading: true,
        error: action.error,
      }
    }
    case PREV: {
      const idx = Math.max(state.currentIndex - 1, 0)
      return {
        ...state,
        currentIndex: idx,
        canSubmit: canSubmit(state.flips, idx),
      }
    }
    case NEXT: {
      const idx = Math.min(state.currentIndex + 1, state.flips.length - 1)
      return {
        ...state,
        currentIndex: idx,
        canSubmit: canSubmit(state.flips, idx),
      }
    }
    case PICK: {
      return {
        ...state,
        currentIndex: action.index,
        canSubmit: canSubmit(state.flips, action.index),
      }
    }
    case ANSWER: {
      const flips = [
        ...state.flips.slice(0, state.currentIndex),
        { ...state.flips[state.currentIndex], answer: action.option },
        ...state.flips.slice(state.currentIndex + 1),
      ]
      return {
        ...state,
        flips,
        canSubmit: canSubmit(flips, state.currentIndex),
      }
    }
    case REPORT_ABUSE: {
      const flips = [
        ...state.flips.slice(0, state.currentIndex),
        {
          ...state.flips[state.currentIndex],
          answer: AnswerType.Inappropriate,
        },
        ...state.flips.slice(state.currentIndex + 1),
      ]

      const availableFlipsLength = flips.filter(x => !x.hidden).length
      const idx = Math.min(state.currentIndex + 1, availableFlipsLength - 1)
      return {
        ...state,
        flips,
        currentIndex: idx,
        canSubmit: canSubmit(flips, idx),
      }
    }
    case SHOW_EXTRA_FLIPS: {
      let flips = state.flips.map(flip => ({
        ...flip,
        failed: !flip.ready,
      }))
      let availableExtraFlips = flips.filter(x => x.failed).length
      let openedFlipsCount = 0
      flips = flips.map(flip => {
        if (!flip.hidden) {
          return flip
        }
        const shouldBecomeAvailable =
          flip.ready && flip.loaded && availableExtraFlips > 0
        availableExtraFlips -= 1
        openedFlipsCount += 1
        return {
          ...flip,
          hidden: !shouldBecomeAvailable,
        }
      })

      for (let i = flips.length - 1; i >= 0; i -= 1) {
        if (openedFlipsCount > 0 && flips[i].failed) {
          openedFlipsCount -= 1
          flips[i].hidden = true
        }
      }

      return {
        ...state,
        canSubmit: canSubmit(flips, state.currentIndex),
        flips: reorderFlips(flips),
        ready: true,
      }
    }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`)
    }
  }
}

const ValidationStateContext = createContext()
const ValidationDispatchContext = createContext()

// eslint-disable-next-line react/prop-types
export function ValidationProvider({ children }) {
  const [state, dispatch] = useLogger(
    useThunk(useReducer(validationReducer, initialState))
  )

  const epoch = useEpochState()
  const seconds = useValidationTimer()

  useEffect(() => {
    const validation = db.getValidation()
    dispatch({ type: LOAD_VALIDATION, validation })
  }, [dispatch])

  useEffect(() => {
    if (epoch !== null) {
      const { epoch: savedEpoch } = db.getValidation()
      if (epoch.epoch !== savedEpoch) {
        // archiveFlips()
        db.resetValidation(epoch.epoch)
        dispatch({ type: RESET_EPOCH, epoch: epoch.epoch })
      }
    }
  }, [dispatch, epoch])

  useEffect(() => {
    async function sendAnswers(type) {
      switch (type) {
        case SessionType.Short: {
          await submitShortAnswers(dispatch, state.flips, epoch.epoch)
          break
        }
        case SessionType.Long: {
          await submitLongAnswers(dispatch, state.flips, epoch.epoch)
          break
        }
        default:
          break
      }
    }

    // prevent mess with epoch and seconds switching simultaneously
    if (seconds === 1) {
      const { shortAnswersSubmitted, flips } = state
      const { currentPeriod } = epoch
      const hasSomeAnswer = flips.map(x => x.answer).some(hasAnswer)

      if (hasSomeAnswer) {
        if (
          currentPeriod === EpochPeriod.ShortSession &&
          !shortAnswersSubmitted
        ) {
          sendAnswers(SessionType.Short)
        }
        // if (
        //   currentPeriod === EpochPeriod.LongSession &&
        //   !longAnswersSubmitted
        // ) {
        //   sendAnswers(SessionType.Long)
        // }
      }
    }
  }, [dispatch, epoch, seconds, state])

  return (
    <ValidationStateContext.Provider value={state}>
      <ValidationDispatchContext.Provider value={dispatch}>
        {children}
      </ValidationDispatchContext.Provider>
    </ValidationStateContext.Provider>
  )
}

export function useValidationState() {
  const context = useContext(ValidationStateContext)
  if (context === undefined) {
    throw new Error(
      'useValidationState must be used within a ValidationProvider'
    )
  }
  return context
}

export function useValidationDispatch() {
  const context = useContext(ValidationDispatchContext)
  if (context === undefined) {
    throw new Error(
      'useValidationDispatch must be used within a ValidationProvider'
    )
  }
  return context
}

export function fetchFlips(type, flips = []) {
  return async dispatch => {
    try {
      const hashes = await fetchFlipHashes(type)
      if (hashes) {
        const data = await Promise.all(
          hashes.map(({ hash, extra: hidden, ready }) => {
            const existingFlip = flips.find(f => f.hash === hash)
            if (existingFlip) {
              if (
                (existingFlip.ready && existingFlip.loaded) ||
                existingFlip.failed
              ) {
                return Promise.resolve({
                  hash: existingFlip.hash,
                  hidden: existingFlip.hidden,
                  ready: existingFlip.ready,
                })
              }
            } else if (!ready) {
              return Promise.resolve({ hash, hidden, ready })
            }
            return fetchFlip(hash).then(resp => ({
              hash,
              hidden,
              ready,
              ...resp.result,
            }))
          })
        )

        dispatch({ type: FETCH_FLIPS_SUCCEEDED, data, sessionType: type })
      } else {
        dispatch({
          type: FETCH_FLIPS_FAILED,
          error: new Error(`Cannot fetch flips`),
        })
      }
    } catch (error) {
      dispatch({ type: FETCH_FLIPS_FAILED, error })
    }
  }
}

function prepareAnswers(flips) {
  return flips.map(flip => ({
    answer: hasAnswer(flip.answer) ? flip.answer : 0,
    easy: false,
    hash: flip.hash,
  }))
}

export function submitShortAnswers(flips, epoch) {
  return async dispatch => {
    const payload = prepareAnswers(flips)

    await submitShortAnswersApi(payload, 0, 0)
    // db.setShortAnswers(payload, epoch)

    dispatch({ type: SUBMIT_SHORT_ANSWERS, answers: payload, epoch })
  }
}

export function submitLongAnswers(flips, epoch) {
  return async dispatch => {
    const payload = prepareAnswers(flips)

    await submitLongAnswersApi(payload, 0, 0)
    // db.setLongAnswers(payload, epoch)

    dispatch({ type: SUBMIT_LONG_ANSWERS, answers: payload, epoch })
  }
}

const GAP = 10
export function useValidationTimer() {
  const epoch = useEpochState()
  const timing = useTimingState()

  const [seconds, setSeconds] = React.useState()

  useEffect(() => {
    if (epoch && timing) {
      const { currentPeriod, currentValidationStart, nextValidation } = epoch

      const {
        ShortSessionDuration: shortSession,
        LongSessionDuration: longSession,
      } = timing

      const start = dayjs(currentValidationStart || nextValidation)
      const duration =
        shortSession +
        (currentPeriod === EpochPeriod.ShortSession ? 0 : longSession) -
        GAP
      const finish = start.add(duration, 's')
      const diff = Math.max(Math.min(finish.diff(dayjs(), 's'), duration), 0)

      setSeconds(diff)
    }
  }, [epoch, timing])

  useInterval(() => setSeconds(seconds - 1), seconds ? 1000 : null)

  return seconds
}
