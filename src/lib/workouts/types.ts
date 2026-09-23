export type Exercise = {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  category: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  instructions: string[];
  images: string[];
};

export type WorkoutRoutine = {
  id: number;
  user_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RoutineExercise = {
  id: number;
  routine_id: number;
  exercise_id: string;
  position: number;
  target_sets: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight_kg: number | null;
  rest_seconds: number;
  notes: string | null;
};

export type Workout = {
  id: number;
  user_id: string;
  routine_id: number | null;
  name: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
};

export type WorkoutExercise = {
  id: number;
  workout_id: number;
  exercise_id: string;
  position: number;
  notes: string | null;
};

export type WorkoutSet = {
  id: number;
  workout_exercise_id: number;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  is_warmup: boolean;
  rest_seconds_actual: number | null;
  completed_at: string;
  created_at: string;
};
