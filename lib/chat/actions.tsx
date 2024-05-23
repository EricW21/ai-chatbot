import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  streamUI,
  createStreamableValue
} from 'ai/rsc'
import { openai } from '@ai-sdk/openai'

import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage,
  Stock,
  Purchase
} from '@/components/stocks'

import { z } from 'zod'
import { EventsSkeleton } from '@/components/stocks/events-skeleton'
import { Events } from '@/components/stocks/events'
import { StocksSkeleton } from '@/components/stocks/stocks-skeleton'
import { Stocks } from '@/components/stocks/stocks'
import { StockSkeleton } from '@/components/stocks/stock-skeleton'
import { kv } from '@vercel/kv';
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Chat, Message } from '@/lib/types'
import { auth } from '@/auth'
import { OpenAI } from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPEN_API_KEY,
  defaultHeaders: {
    "OpenAI-Beta": "assistants=v2"
  }
});
let assistant: any;
let thread: any;
(async () => {
  try {
    assistant = await client.beta.assistants.create({
      name: "Stock Trading Bot",
      instructions: "You are a stock trading bot. Help answer questions about stock trading.",
      tools: [{ type: "code_interpreter" }],
      model: "gpt-3.5-turbo", 
    });
    thread = await client.beta.threads.create();
    
  } catch (error) {
    console.error("Error fetching assistant:", error);
  }
})();

async function confirmPurchase(symbol: string, price: number, amount: number) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  const purchasing = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      {spinner}
      <p className="mb-2">
        Purchasing {amount} ${symbol}...
      </p>
    </div>
  )

  const systemMessage = createStreamableUI(null)

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000)

    purchasing.update(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
          Purchasing {amount} ${symbol}... working on it...
        </p>
      </div>
    )

    await sleep(1000)

    purchasing.done(
      <div>
        <p className="mb-2">
          You have successfully purchased {amount} ${symbol}. Total cost:{' '}
          {formatNumber(amount * price)}
        </p>
      </div>
    )

    systemMessage.done(
      <SystemMessage>
        You have purchased {amount} shares of {symbol} at ${price}. Total cost ={' '}
        {formatNumber(amount * price)}.
      </SystemMessage>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'system',
          content: `[User has purchased ${amount} shares of ${symbol} at ${price}. Total cost = ${
            amount * price
          }]`
        }
      ]
    })
  })

  return {
    purchasingUI: purchasing.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value
    }
  }
}


async function handleFile(formData: FormData) {
  'use server'
  const file = formData.get('file');
  if (file) {
    const uploadedFile = await client.files.create({
      file: file as File,
      purpose:'assistants'
     });
     let existing_ids = assistant.tool_resources.code_interpreter.file_ids;
     
     
     await client.beta.assistants.update(assistant.id, {
      tool_resources: {
        code_interpreter: {
          file_ids : [...existing_ids,uploadedFile.id]
        }
      },
     });
     
    return {  
      id: nanoid(),
      display: 'Recieved File, will take a while'
    }
  }
  else {
    return {  
      id: nanoid(),
      display: 'File was not proccesed, please try again'
    }
  }
}

async function submitUserMessage(content: string, threadId:string) {
  'use server'
  
  if (typeof(threadId)==='undefined' || threadId===null) {
    console.log(JSON.stringify(thread));

    threadId=thread.id;
    
    await kv.hset(`thread:${threadId}`, { type: 'thread', id: threadId });
  }
  
  const message = await client.beta.threads.messages.create(threadId,{
    role: "user",
    content: content
});


  let checkMessage = await client.beta.threads.messages.list(threadId, {
    order: 'desc'
  });
  let messageCount = checkMessage.data.length;
  const run = await client.beta.threads.runs.create(threadId, {
    assistant_id: assistant.id,
  }
  )
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  for (let i=0;i<6;i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    checkMessage = await client.beta.threads.messages.list(threadId, {
      order: 'desc'
    });
    if (checkMessage.data.length>=messageCount && checkMessage.data[0].content[0]!==null && typeof checkMessage.data[0].content[0] !== 'undefined') {
      console.log(JSON.stringify(checkMessage.data[0].content[0])+'bug checking')
      break;
    }
    else if (i==5) {
      return {  
        id: nanoid(),
        display: "Loading, please try again"
      }
    }
    
  }
  
  
 
  
  if (checkMessage.data[0].content[0].text.value===content) {
    return {
      id: nanoid(),
    display: "Loading, please try again"
    }
  }
  return {  
    id: nanoid(),
    display: checkMessage.data[0].content[0].text.value
  }
}

export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    confirmPurchase,
    handleFile
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState()

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  onSetAIState: async ({ state }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`

      const firstMessageContent = messages[0].content as string
      const title = firstMessageContent.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'tool' ? (
          message.content.map(tool => {
            return tool.toolName === 'listStocks' ? (
              <BotCard>
                {/* TODO: Infer types based on the tool result*/}
                {/* @ts-expect-error */}
                <Stocks props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPrice' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Stock props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPurchase' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Purchase props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'getEvents' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Events props={tool.result} />
              </BotCard>
            ) : null
          })
        ) : message.role === 'user' ? (
          <UserMessage>{message.content as string}</UserMessage>
        ) : message.role === 'assistant' &&
          typeof message.content === 'string' ? (
          <BotMessage content={message.content} />
        ) : null
    }))
}
