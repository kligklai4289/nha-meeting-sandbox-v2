import { RouterProvider } from 'react-router-dom'
import { createAppRouter } from './router'

const browserRouter = createAppRouter()

export function App() {
  return <RouterProvider router={browserRouter} />
}
