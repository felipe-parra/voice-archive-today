import React, { useState } from 'react' // Add React and useState import
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { format } from 'date-fns'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { updateProfile } from '@/data/voiceNotes'
import { USE_FIXTURES } from '@/data/mode'

const profileFormSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  birthdate: z.date({
    required_error: 'Please select a date.',
  }),
  avatar_url: z.string().optional(),
})

type ProfileFormProps = {
  initialData: z.infer<typeof profileFormSchema>
  onSave: () => void
}

export function ProfileForm({ initialData, onSave }: ProfileFormProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false) // Existing useState hook

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: initialData,
  })

  const onSubmit = async (values: z.infer<typeof profileFormSchema>) => {
    if (USE_FIXTURES) {
      toast({
        title: 'Demo mode',
        description: 'This action is disabled in the fixture preview.',
      })
      return
    }
    setIsSaving(true)
    try {
      await updateProfile({ full_name: values.full_name, gender: values.gender, birthdate: format(values.birthdate, 'yyyy-MM-dd'), avatar_url: values.avatar_url })
      toast({ title: 'Success', description: 'Profile updated successfully' })
      onSave()
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update profile', variant: 'destructive' })
    } finally { setIsSaving(false) }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your full name"
                  {...field}
                  className="bg-card border-input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gender</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-card border-input">
                    <SelectValue placeholder="Select your gender" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">
                    Prefer not to say
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="birthdate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date of birth</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full pl-3 text-left font-normal bg-card',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            type="button"
            onClick={() => window.history.back()}
          >
            Back
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  )
}
