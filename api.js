import reactotron from 'reactotron-react-native'
import { URL } from './config'

async function callRpc(method, ...params) {
  try {
    const resp = await fetch(URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method,
        params,
        id: 1,
      }),
    })
    const json = await resp.json()
    return json
  } catch (error) {
    return { error }
  }
}

export async function fetchFlipHashes(type) {
  const { result } = await callRpc(`flip_${type}Hashes`)
  return result
}

export async function fetchFlip(hash) {
  return callRpc('flip_get', hash)
}

export async function submitShortAnswers(answers, nonce, epoch) {
  const { result } = await callRpc(`flip_submitShortAnswers`, {
    answers,
    nonce,
    epoch,
  })
  return result
}

export async function submitLongAnswers(answers, nonce, epoch) {
  const { result } = await callRpc(`flip_submitLongAnswers`, {
    answers,
    nonce,
    epoch,
  })
  return result
}
