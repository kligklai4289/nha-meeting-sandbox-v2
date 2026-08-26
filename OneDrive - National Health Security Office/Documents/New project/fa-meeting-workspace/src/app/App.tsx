import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './AppProviders'
import { createAppRouter } from './router'

const browserRouter = createAppRouter()

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={browserRouter} />
    </AppProviders>
  )
}
