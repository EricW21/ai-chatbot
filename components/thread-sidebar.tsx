// "use client";

// import React, { useEffect, useState } from 'react';

// import { useRouter } from 'next/navigation'
// function ThreadSidebar() {
//     const router = useRouter()
//     const [threadData, setThreadData] = useState<string[]>([]);
//     const handleThread = (id) => {
//         localStorage.setItem('threadId', id);
//         router.push('/new');
//     }
//     useEffect(() => {
//         setThreadData(threadData);
//       }, [])

//     const fetchThreadData = async () => {
//         try {
//             let newest_thread = '3';
//             // let newest_thread = call some serverless function
//             setThreadData([...threadData,newest_thread]);
//         } catch (error) {
//             console.error('Error fetching thread data:', error);
//         }
//     };
    
//     return <div className="thread-sidebar">
//         Previous Conversations
//         <ul style={{ padding: '10px', backgroundColor: 'lightblue'}}>
        
//         {Array.isArray(threadData) && threadData.length > 0 ? (
//         threadData.map((id) => (
//           <li key={id} onClick={() => handleThread(id)} id={id}>{id}</li>
//         ))
//       ) : (
//         <li>No previous conversations</li>
//       )}
//         </ul>
//     </div>
// }
// export default ThreadSidebar;