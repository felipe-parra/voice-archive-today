export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []

  cancel() {
    this.mediaRecorder?.stream.getTracks().forEach(track => track.stop())
    this.mediaRecorder = null
    this.audioChunks = []
  }

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      try { this.mediaRecorder = new MediaRecorder(stream) }
      catch (error) { stream.getTracks().forEach(track => track.stop()); throw error }
      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.start()
    } catch (error) {
      console.error('Error starting recording:', error)
      throw error
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        throw new Error('No recording in progress')
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || this.audioChunks[0]?.type || 'audio/webm' })
        const tracks = this.mediaRecorder?.stream.getTracks()
        tracks?.forEach((track) => track.stop())
        resolve(audioBlob)
      }

      this.mediaRecorder.stop()
    })
  }
}
