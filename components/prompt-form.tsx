'use client'

import * as React from 'react'
import Textarea from 'react-textarea-autosize'

import { useActions, useUIState } from 'ai/rsc'

import { UserMessage } from './stocks/message'
import { type AI } from '@/lib/chat/actions'
import { Button } from '@/components/ui/button'
import { IconArrowElbow, IconPlus } from '@/components/ui/icons'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useEnterSubmit } from '@/lib/hooks/use-enter-submit'
import { nanoid } from 'nanoid'
import { useRouter } from 'next/navigation'

export function PromptForm({
  input,
  setInput,
  file,
  setFile
}: {
  input: string
  
  setInput: (value: string) => void
  file: File | undefined;
  setFile: (file: File | undefined) => void;
}) {
  const router = useRouter()
  const { formRef, onKeyDown } = useEnterSubmit()

  // added the inputRef/fileInputRef for keeping track of the file
  // added the handleFile function which is in lib/chat/actions.tsx
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { submitUserMessage, handleFile } = useActions()
  const [_, setMessages] = useUIState<typeof AI>()

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  
 

  return (
    <form
      ref={formRef}
      onSubmit={async (e: any) => {
        e.preventDefault()

        // Blur focus on mobile
        if (window.innerWidth < 600) {
          e.target['message']?.blur()
        }
        
        const value = input.trim()
        setInput('')
        if (!value && !file) return

        // if file then it just handles the file and not the message to prevent multiple Openapi runs
        if (file) {
          setFile(undefined);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          // user sees a Uploaded File message and a recieved file message should appear soon after
          setMessages(currentMessages => [
            ...currentMessages,
            {
              id: nanoid(),
              display: <UserMessage>Uploaded File</UserMessage>
            }
          ])
          const formData = new FormData();
          formData.append('file', file);
          const responseMessage = await handleFile(formData);
          // recieved file message should appear if file is valid
          setMessages(currentMessages => [...currentMessages, responseMessage])
        }
        else {
        // Optimistically add user message UI
        setMessages(currentMessages => [
          ...currentMessages,
          {
            id: nanoid(),
            display: <UserMessage>{value}</UserMessage>
          }
        ])

        // Submit and get response message
        let threadId = localStorage.getItem('threadId');
        const responseMessage = await submitUserMessage(value)
        setMessages(currentMessages => [...currentMessages, responseMessage])
      }}}
    >
      <div className="relative flex max-h-60 w-full grow flex-col overflow-hidden bg-background px-8 sm:rounded-md sm:border sm:px-12">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-[14px] size-8 rounded-full bg-background p-0 sm:left-4"
              onClick={() => {
                router.push('/new')
              }}
            >
              <IconPlus />
              <span className="sr-only">New Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>

        
        <input type="file" id="fileInput" ref={fileInputRef} onChange={(e) => setFile(e.target.files?.[0])}/>
          
        

        <Textarea
          ref={inputRef}
          
          tabIndex={0}
          onKeyDown={onKeyDown}
          placeholder="Send a message."
          className="min-h-[60px] w-full resize-none bg-transparent px-4 py-[1.3rem] focus-within:outline-none sm:text-sm"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          name="message"
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <div className="absolute right-0 top-[13px] sm:right-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="submit" size="icon" disabled={input === '' && !file}>
                <IconArrowElbow />
                <span className="sr-only">Send message</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send message</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </form>
  )
}
