import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileDropzone, type FileDropzoneItem } from './file-dropzone'
import type { Uploader } from '@/shared/lib/uploader'

function makeFile(name: string, type: string, sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

/** Uploader controlable a mano — resuelve/rechaza cuando el test lo decide, en vez de depender de timers. */
function makeControllableUploader() {
  let resolveUpload: (result: { url: string }) => void = () => {}
  let rejectUpload: (error: Error) => void = () => {}
  const uploader: Uploader = {
    upload: () =>
      new Promise((resolve, reject) => {
        resolveUpload = resolve
        rejectUpload = reject
      }),
  }
  return {
    uploader,
    resolveUpload: (url: string) => resolveUpload({ url }),
    rejectUpload: () => rejectUpload(new Error('boom')),
  }
}

/** Wrapper controlado — mismo criterio que los tests de `Select`. */
function ControlledDropzone(
  props: Partial<React.ComponentProps<typeof FileDropzone>> & { uploader: Uploader }
) {
  const [value, setValue] = useState<FileDropzoneItem[]>(props.value ?? [])
  return (
    <FileDropzone
      uploadKind="logo"
      label="Elegí un archivo"
      value={value}
      onChange={setValue}
      {...props}
    />
  )
}

describe('FileDropzone', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:fake') })
  })

  it('sube un archivo válido: pasa por "Subiendo…" y termina en éxito', async () => {
    const { uploader, resolveUpload } = makeControllableUploader()
    render(<ControlledDropzone uploader={uploader} />)

    const input = screen.getByLabelText('Elegí un archivo', { selector: 'input' })
    fireEvent.change(input, { target: { files: [makeFile('logo.png', 'image/png')] } })

    expect(screen.getByText('logo.png')).toBeInTheDocument()
    expect(screen.getByText(/Subiendo…/)).toBeInTheDocument()

    resolveUpload('blob:uploaded-logo')

    await waitFor(() => expect(screen.queryByText(/Subiendo…/)).not.toBeInTheDocument())
    expect(screen.getByText('logo.png')).toBeInTheDocument()
  })

  it('rechaza un formato inválido sin llamar al uploader', () => {
    const { uploader } = makeControllableUploader()
    const uploadSpy = vi.spyOn(uploader, 'upload')
    render(<ControlledDropzone uploader={uploader} uploadKind="logo" />)

    const input = screen.getByLabelText('Elegí un archivo', { selector: 'input' })
    fireEvent.change(input, { target: { files: [makeFile('logo.gif', 'image/gif')] } })

    expect(screen.getByRole('alert')).toHaveTextContent('Formato no soportado')
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('rechaza un archivo que excede el tamaño máximo, con el MB permitido en el mensaje', () => {
    const { uploader } = makeControllableUploader()
    render(<ControlledDropzone uploader={uploader} uploadKind="logo" />)

    const input = screen.getByLabelText('Elegí un archivo', { selector: 'input' })
    fireEvent.change(input, {
      target: { files: [makeFile('logo.png', 'image/png', 3 * 1024 * 1024)] },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('2 MB')
  })

  it('rechaza un .mov de video de verificación con el mensaje específico, no uno genérico', () => {
    const { uploader } = makeControllableUploader()
    render(<ControlledDropzone uploader={uploader} uploadKind="verificationVideo" />)

    const input = screen.getByLabelText('Elegí un archivo', { selector: 'input' })
    fireEvent.change(input, { target: { files: [makeFile('negocio.mov', 'video/quicktime')] } })

    expect(screen.getByRole('alert')).toHaveTextContent('convertirlos')
  })

  it('deshabilita el input y avisa al llegar al máximo de archivos', () => {
    const { uploader } = makeControllableUploader()
    const fiveItems: FileDropzoneItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: `f${i}`,
      file: makeFile(`foto-${i}.jpg`, 'image/jpeg'),
      status: 'success',
      url: 'blob:x',
    }))
    render(
      <ControlledDropzone
        uploader={uploader}
        uploadKind="placePhoto"
        multiple
        maxFiles={5}
        value={fiveItems}
      />
    )

    expect(screen.getByText(/máximo de 5 archivos/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Elegí un archivo', { selector: 'input' })).toBeDisabled()
  })

  it('reintentar tras un error de subida vuelve a llamar al uploader y termina en éxito', async () => {
    const first = makeControllableUploader()
    render(<ControlledDropzone uploader={first.uploader} uploadKind="logo" />)

    const input = screen.getByLabelText('Elegí un archivo', { selector: 'input' })
    fireEvent.change(input, { target: { files: [makeFile('logo.png', 'image/png')] } })
    first.rejectUpload()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(screen.getByText(/Subiendo…/)).toBeInTheDocument()

    first.resolveUpload('blob:retried-logo')
    await waitFor(() => expect(screen.queryByText(/Subiendo…/)).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('un segundo reintento que también falla deja el archivo en error de nuevo', async () => {
    const uploader = makeControllableUploader()
    render(<ControlledDropzone uploader={uploader.uploader} uploadKind="logo" />)

    const input = screen.getByLabelText('Elegí un archivo', { selector: 'input' })
    fireEvent.change(input, { target: { files: [makeFile('logo.png', 'image/png')] } })
    uploader.rejectUpload()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    uploader.rejectUpload()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    )
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos subir el archivo')
  })

  it('arrastrar y soltar un archivo lo agrega igual que elegirlo desde el input', () => {
    const { uploader } = makeControllableUploader()
    render(<ControlledDropzone uploader={uploader} uploadKind="logo" />)

    const dropArea = screen.getByRole('group', { name: 'Elegí un archivo' })
    fireEvent.dragOver(dropArea, { dataTransfer: { files: [] } })
    fireEvent.dragLeave(dropArea)
    fireEvent.drop(dropArea, { dataTransfer: { files: [makeFile('logo.png', 'image/png')] } })

    expect(screen.getByText('logo.png')).toBeInTheDocument()
  })

  it('soltar un archivo estando al límite no lo agrega', () => {
    const { uploader } = makeControllableUploader()
    const fiveItems: FileDropzoneItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: `f${i}`,
      file: makeFile(`foto-${i}.jpg`, 'image/jpeg'),
      status: 'success',
      url: 'blob:x',
    }))
    render(
      <ControlledDropzone
        uploader={uploader}
        uploadKind="placePhoto"
        multiple
        maxFiles={5}
        value={fiveItems}
      />
    )

    const dropArea = screen.getByRole('group', { name: 'Elegí un archivo' })
    fireEvent.drop(dropArea, {
      dataTransfer: { files: [makeFile('foto-nueva.jpg', 'image/jpeg')] },
    })

    expect(screen.queryByText('foto-nueva.jpg')).not.toBeInTheDocument()
  })

  it('quitar un archivo lo saca de la lista', () => {
    const { uploader } = makeControllableUploader()
    render(<ControlledDropzone uploader={uploader} uploadKind="logo" />)

    const input = screen.getByLabelText('Elegí un archivo', { selector: 'input' })
    fireEvent.change(input, { target: { files: [makeFile('logo.gif', 'image/gif')] } })
    expect(screen.getByText('logo.gif')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Quitar logo.gif/i }))
    expect(screen.queryByText('logo.gif')).not.toBeInTheDocument()
  })
})
