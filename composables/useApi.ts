/** Token del panel (cabecera x-admin-token) y llamadas a la API con él. El token se guarda solo en esta pestaña. */
export function useAdminToken() {
  const token = useState('adminToken', () => '')
  if (import.meta.client) {
    onMounted(() => {
      try { token.value = sessionStorage.getItem('adminToken') || token.value } catch {}
    })
    watch(token, (v) => { try { sessionStorage.setItem('adminToken', v) } catch {} })
  }
  const headers = computed<Record<string, string>>(() => (token.value ? { 'x-admin-token': token.value } : {}))
  return { token, headers }
}

export function useApi<T>(url: string | (() => string), extraWatch: any[] = []) {
  const { token, headers } = useAdminToken()
  // Cabecera reactiva y solo en cliente: el token vive en sessionStorage y el servidor no lo conoce.
  return useFetch<T>(url, { headers, server: false, watch: [token, ...extraWatch] })
}

export function apiCall<T = any>(url: string, method: 'POST' | 'PATCH', body?: object) {
  const { headers } = useAdminToken()
  return $fetch<T>(url, { method, body, headers: headers.value })
}
