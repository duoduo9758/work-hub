import { useState } from 'react'

// Standard 3-state loading pattern: { loading, error, data }
export function useLoadingState(initialData = null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(initialData)

  async function run(asyncFn) {
    setLoading(true)
    setError(null)
    try {
      const result = await asyncFn()
      setData(result)
      return result
    } catch (e) {
      setError(e.message || 'エラーが発生しました')
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { loading, error, data, setData, run }
}
