import TaskCard from '../../components/tasks/TaskCard'
import { Task } from '../../types'

const sampleTask: Task = {
  id: '1',
  title: 'Sample Task',
  description: 'This is a sample task for testing edit/delete buttons',
  status: 'pending' as any,
  priority: 'medium' as any,
  due_date: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  tags: ['test'],
  metadata: {}
}

export default function TaskDebugPage() {
  const handleUpdate = (task: Task) => {
    console.log('Update task clicked:', task)
    alert('Edit button clicked!')
  }

  const handleDelete = (taskId: string) => {
    console.log('Delete task clicked:', taskId)
    alert('Delete button clicked!')
  }

  const handleClick = (task: Task) => {
    console.log('Task clicked:', task)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Task Debug Page</h1>
      <div className="max-w-md">
        <TaskCard
          task={sampleTask}
          onClick={handleClick}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          showCategory={true}
          showDueDate={true}
        />
      </div>
    </div>
  )
}
