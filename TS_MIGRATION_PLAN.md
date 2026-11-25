# Frontend TypeScript Migration & Mentorship Plan

## Goal Description
Migrate the existing React 19 + Vite frontend in [`client/`](client) to TypeScript with a strong pedagogical focus. 

Instead of an automated mass-conversion, this plan structures the migration into **8 progressive milestones** designed to build a rock-solid mental model of TypeScript. You will write the code yourself, file by file, while Antigravity acts as your personal teacher and mentor—explaining concepts, reviewing your code, breaking down compiler errors, and suggesting idiomatic TypeScript patterns.

```
                    MIGRATION & LEARNING ROADMAP
 ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
 │   Milestone 1   │  ──>  │   Milestone 2   │  ──>  │   Milestone 3   │
 │ Tooling & Setup │       │ Domain Modeling │       │  Context & API  │
 └─────────────────┘       └─────────────────┘       └─────────────────┘
                                                              │
                                                              ▼
 ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
 │   Milestone 6   │  <──  │   Milestone 5   │  <──  │   Milestone 4   │
 │ Complex Chat UI │       │ Modals & Lists  │       │ Leaf Components │
 └─────────────────┘       └─────────────────┘       └─────────────────┘
         │
         ▼
 ┌─────────────────┐       ┌─────────────────┐
 │   Milestone 7   │  ──>  │   Milestone 8   │
 │  Pages & Layout │       │ Root & Polish   │
 └─────────────────┘       └─────────────────┘
```

---

## Mentorship Workflow Rules

> [!IMPORTANT]
> **Strict Mentorship Workflow**:
> Antigravity will **not** modify or create any code files in `client/` directly unless requested. 
> For each milestone:
> 1. We introduce the core TypeScript concepts relevant to that step.
> 2. We present the exact types, interfaces, and patterns to aim for.
> 3. You implement the changes in your editor.
> 4. We run `tsc --noEmit` and tests together to review and resolve any compiler diagnostics.

> [!NOTE]
> **Incremental Migration Strategy**:
> Vite natively supports mixed `.js`, `.jsx`, `.ts`, and `.tsx` files in the same project! 
> This means your development server and builds will remain operational after every single file migration—you never have a broken app while in the middle of learning.

---

## Configuration & Strictness

- Strict mode is enabled (`"strict": true` in `tsconfig.json`).
- Compiler options include `"moduleResolution": "bundler"`, `"jsx": "react-jsx"`, and `"noEmit": true`.
- Environment typing is handled globally via `src/vite-env.d.ts`.

---

## Proposed Changes & Learning Milestones

---

### Milestone 1: Tooling & TypeScript Configuration (Completed ✅)

**Key Concepts Learned**:
- What `tsc` does vs what Vite does (Vite strips types fast via esbuild/swc; `tsc` performs type checking).
- `tsconfig.json` compiler options (`target`, `module`, `strict`, `jsx`, `skipLibCheck`, `moduleResolution: bundler`).
- Triple-slash directives and environment typing in Vite (`vite-env.d.ts`).

#### Files Created/Modified:
- [NEW] `client/tsconfig.json`
- [NEW] `client/src/vite-env.d.ts`
- [MODIFY] `client/package.json` (`typescript`, `@types/node`, `"type-check": "tsc --noEmit"`)

---

### Milestone 2: Domain Data Modeling (Completed ✅)

**Key Concepts Learned**:
- `interface` vs `type` aliases: when and why to use which.
- Modeling MongoDB document shapes in TypeScript (`_id: string`, `createdAt: string`).
- Discriminated unions, optional properties (`?`), and array types (`string[]`, `User[]`).
- Exporting and sharing types across your frontend.

#### Files Created:
- [NEW] `client/src/types/index.ts`
  - `User`, `AuthResponse`, `Message`, `Group`, `GroupMessage`, `MediaType`, `FilePreview`

---

### Milestone 3: Utilities, Configs & React Contexts (Completed ✅)

**Key Concepts Learned**:
- Typing React Context (`createContext<ContextType | undefined>(undefined)`).
- Safe custom hook pattern (type narrowing by throwing an error if hook is used outside Provider).
- Typing `useRef` for mutable objects (like Socket.IO instance).
- Typing async Firebase authentication return values.

#### Files to Migrate:
- [MODIFY] `client/src/api/config.js` -> `config.ts`
  - Type the exported base URL string and env fallbacks.
- [MODIFY] `client/src/config/firebase.js` -> `firebase.ts`
  - Type Firebase `App`, `Auth`, `GoogleAuthProvider`, and `UserCredential`.
- [MODIFY] `client/src/context/ThemeContext.jsx` -> `ThemeContext.tsx`
  - Define `type Theme = 'light' | 'dark'`.
  - Define `ThemeContextType = { theme: Theme; setTheme: React.Dispatch<React.SetStateAction<Theme>> }`.
  - Type `ThemeProvider` props (`{ children: React.ReactNode }`).
- [MODIFY] `client/src/context/SocketContext.jsx` -> `SocketContext.tsx`
  - Define `SocketContextType` containing `token`, `user`, `setUser`, `login`, `logout`, `socketConnected`, `onlineUsers`, `socketRef`.
  - Type `socketRef: React.RefObject<Socket | null>`.

---

### Milestone 4: Leaf Components & Unit Tests (Completed ✅)

**Key Concepts Learned**:
- Typing component props with TypeScript interfaces.
- Typing React elements and children.
- Updating Vitest tests to `.test.tsx` and typing DOM assertions.

#### Files to Migrate:
- [MODIFY] `client/src/components/WelcomeScreen.jsx` -> `WelcomeScreen.tsx`
  - Clean stateless component with no props to get comfortable with `.tsx` syntax.
- [MODIFY] `client/src/components/__tests__/WelcomeScreen.test.jsx` -> `WelcomeScreen.test.tsx`
  - Ensure test runner compiles and runs `.tsx` tests smoothly.
- [MODIFY] `client/src/components/MediaModal.jsx` -> `MediaModal.tsx`
  - Typing props: `isOpen: boolean`, `onClose: () => void`, `mediaUrl: string`, `mediaType: 'image' | 'video'`.
- [MODIFY] `client/src/components/chat/ChatHeader.jsx` -> `ChatHeader.tsx`
  - Typing navigation actions and params.

---

### Milestone 5: List Views & Modal Components (Completed ✅)

**Key Concepts Learned**:
- Typing third-party libraries (`react-virtuoso` item renderers).
- SWR generic typing: `useSWR<User[]>(url, fetcher)`.
- Typing callbacks passed as props: `(id: string) => void`.
- Typing form state for group creation and file inputs.

#### Files to Migrate:
- [MODIFY] `client/src/components/Contacts.jsx` -> `Contacts.tsx`
  - Type `ContactItemProps` (`contact: User`, `isActive: boolean`, `isOnline: boolean`, `onClick: (id: string) => void`).
  - Type Virtuoso `itemContent` callback.
- [MODIFY] `client/src/components/GroupTab.jsx` -> `GroupTab.tsx`
  - Type group list fetching and active group selection.
- [MODIFY] `client/src/components/CreateGroupModal.jsx` -> `CreateGroupModal.tsx`
  - Type multi-select member state (`selectedMembers: string[]`), file uploads, and submission.
- [MODIFY] `client/src/components/GroupInfoModal.jsx` -> `GroupInfoModal.tsx`
  - Type group metadata display, member lists, and admin badge logic.

---

### Milestone 6: Core Interactive Components (Completed ✅)

**Key Concepts Learned**:
- Complex `useState` and state updater functions: `React.Dispatch<React.SetStateAction<Message[]>>`.
- Typing HTML element refs (`useRef<HTMLDivElement>(null)`, `useRef<HTMLInputElement>(null)`).
- Typing DOM events (`React.ChangeEvent<HTMLInputElement>`, `React.KeyboardEvent<HTMLInputElement>`).
- Audio recorder API and Blob typing (`MediaRecorder`, `Blob`).
- Emoji picker callback typing (`EmojiClickData`).

#### Files to Migrate:
- [MODIFY] `client/src/components/chat/MessageArea.jsx` -> `MessageArea.tsx`
  - Type `MessageAreaProps`: `messages: Message[]`, `setMessages: React.Dispatch<React.SetStateAction<Message[]>>`, `setGroupInfo?: (group: Group) => void`.
  - Scroll pagination logic and duplicate filtering with typed Sets: `Set<string>`.
- [MODIFY] `client/src/components/chat/InputBar.jsx` -> `InputBar.tsx`
  - Audio recording state, file preview objects (`previewUrl: string`, `file: File`).
  - Typing multipart `FormData` uploads.

---

### Milestone 7: Pages & Layouts (Completed ✅)

**Key Concepts Learned**:
- React Router v7 hooks with TypeScript: `useParams<{ userId?: string; groupId?: string }>()`, `useNavigate()`, `useLocation()`.
- Typing form submissions (`React.FormEvent<HTMLFormElement>`).
- Axios response generics: `axios.post<ApiResponse<UserData>>(url, body)`.

#### Files to Migrate:
- [MODIFY] `client/src/pages/Login.jsx` -> `Login.tsx` & `SignUp.jsx` -> `SignUp.tsx`
  - Login and Signup form states, validation, and error typing.
- [MODIFY] `client/src/pages/Profile.jsx` -> `Profile.tsx` & `Settings.jsx` -> `Settings.tsx`
  - Form editing, avatar uploads, and tab states (`'profile' | 'appearance'`).
- [MODIFY] `client/src/pages/Chat.jsx` -> `Chat.tsx` & `Group.jsx` -> `Group.tsx`
  - Typing page message state and passing down to `ChatHeader`, `MessageArea`, and `InputBar`.
- [MODIFY] `client/src/layouts/MainLayout.jsx` -> `MainLayout.tsx`
  - Typing sidebar tab state (`'chats' | 'groups'`), clipboard API handling, and layout responsive toggles.

---

### Milestone 8: Application Root, Entrypoint & Final Polish (Completed ✅)

**Key Concepts Learned**:
- Typing routes with `createBrowserRouter`.
- Protected route wrapper with typed `children: React.ReactNode`.
- Updating HTML entry script to `/src/main.tsx`.
- Final build validation with `tsc -b`.

#### Files to Migrate:
- [MODIFY] `client/src/App.jsx` -> `App.tsx`
  - Axios interceptor typing and token/user initialization.
- [MODIFY] `client/src/main.jsx` -> `main.tsx`
  - Non-null assertion on root element: `document.getElementById('root')!`.
- [MODIFY] `client/index.html`
  - Update script tag from `/src/main.jsx` to `/src/main.tsx`.
- [MODIFY] `client/vite.config.js` -> `vite.config.ts`
  - Type-safe Vite configuration.

---

## Verification Plan

### Automated Type Checks & Tests
At each milestone, we run:
```bash
# 1. Check TypeScript compiler diagnostics (must exit with 0 errors)
cd client
npm run type-check

# 2. Run existing Vitest test suite
npm test

# 3. Test production build
npm run build
```

### Manual Verification Flow
After key milestones and at project completion:
1. **Authentication Flow**: Login and Google Auth work seamlessly; token and user stored in localStorage.
2. **Real-time 1-on-1 Chat**: Sending and receiving text, images, and audio messages.
3. **Group Chat**: Creating groups, selecting members, viewing group info modal.
4. **Theme Switcher**: Switching between light and dark themes applies proper CSS classes and persists.
5. **Responsive Layout**: Sidebar collapsible on mobile/tablet screens.
