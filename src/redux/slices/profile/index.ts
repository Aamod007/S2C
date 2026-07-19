import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { NormalizedProfile } from "@/types/user";

interface ProfileState {
  user: NormalizedProfile | null;
}

const initialState: ProfileState = {
  user: null,
};

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    setProfile: (state, action: PayloadAction<NormalizedProfile>) => {
      state.user = action.payload;
    },
    clearProfile: (state) => {
      state.user = null;
    },
  },
});

export const { setProfile, clearProfile } = profileSlice.actions;
export default profileSlice.reducer;
