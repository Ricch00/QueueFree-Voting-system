import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { registerStudent } from '../../services/api';
import { getDeviceFingerprint } from '../../utils/deviceFingerprint';
import { colors, spacing, radius, shadow } from '../../utils/theme';

const LEVELS = ['100','200','300','400','500','600','postgrad'];

export default function RegisterScreen({ navigation }) {
  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [program, setProgram] = useState('');
  const [level, setLevel] = useState('100');
  const [department, setDepartment] = useState('');
  const [faculty, setFaculty] = useState('');
  const [hall, setHall] = useState('');
  const [idPhoto, setIdPhoto] = useState('');
  const [selfie, setSelfie] = useState('');

  const form = {
    student_id: studentId, full_name: fullName, email, phone,
    password, confirm_password: confirmPassword,
    program, level, department, faculty, hall,
    id_photo: idPhoto, selfie
  };

  const pickImage = async (field) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photos to upload verification images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const base64 = `data:${asset.type === 'video' ? 'video/mp4' : 'image/jpeg'};base64,${asset.base64}`;
      if (field === 'id_photo') setIdPhoto(base64);
      if (field === 'selfie') setSelfie(base64);
    }
  };

  const next = () => {
    if (step === 1) {
      if (!form.student_id || !form.full_name || !form.email) return Alert.alert('Error', 'Fill all required fields');
      if (!form.email.includes('@')) return Alert.alert('Error', 'Enter a valid email');
    }
    if (step === 2) {
      if (!form.password || !form.confirm_password) return Alert.alert('Error', 'Fill password fields');
      if (form.password !== form.confirm_password) return Alert.alert('Error', 'Passwords do not match');
      if (form.password.length < 8) return Alert.alert('Error', 'Password must be at least 8 characters');
    }
    setStep(s => s + 1);
  };

  const handleRegister = async () => {
    if (!form.program.trim()) return Alert.alert('Error', 'Please enter your program');
    if (!form.id_photo || !form.selfie) return Alert.alert('Error', 'Please upload both your ID photo and selfie for verification');
    setLoading(true);
    try {
      const device_fingerprint = await getDeviceFingerprint();
      await registerStudent({ ...form, device_fingerprint });
      Alert.alert('Registration Successful! 🎉',
        'Your account has been created. Please wait for verification by the Electoral Commission before you can vote.',
        [{ text: 'Go to Login', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err) {
      Alert.alert('Registration Failed', err.message || 'Please try again');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.appName}>🗳️ QueueFree</Text>
          <Text style={s.tagline}>Create Your Voter Account</Text>
        </View>

        {/* Step indicator */}
        <View style={s.steps}>
          {[1,2,3].map((n, i) => (
            <React.Fragment key={n}>
              <View style={[s.stepDot, step >= n && s.stepDotActive]}>
                <Text style={[s.stepNum, step >= n && { color: colors.white }]}>{n}</Text>
              </View>
              {i < 2 && <View style={[s.stepLine, step > n && s.stepLineActive]} />}
            </React.Fragment>
          ))}
        </View>

        <View style={s.card}>
          {step === 1 && <>
            <Text style={s.cardTitle}>Personal Information</Text>
            <View style={s.field}>
              <Text style={s.label}>Student ID *</Text>
              <TextInput 
                style={s.input} 
                placeholderTextColor={colors.gray400} 
                value={studentId}
                onChangeText={setStudentId}
                placeholder="e.g. USTED/CS/001"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Full Name *</Text>
              <TextInput 
                style={s.input} 
                placeholderTextColor={colors.gray400} 
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full legal name"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Email Address *</Text>
              <TextInput 
                style={s.input} 
                placeholderTextColor={colors.gray400} 
                value={email}
                onChangeText={setEmail}
                placeholder="student@ug.edu.gh"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Phone Number</Text>
              <TextInput 
                style={s.input} 
                placeholderTextColor={colors.gray400} 
                value={phone}
                onChangeText={setPhone}
                placeholder="+233 XX XXX XXXX"
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </>}

          {step === 2 && <>
            <Text style={s.cardTitle}>Set Password</Text>
            <View style={s.field}>
              <Text style={s.label}>Password *</Text>
              <TextInput 
                style={s.input} 
                placeholderTextColor={colors.gray400} 
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 8 characters"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Confirm Password *</Text>
              <TextInput 
                style={s.input} 
                placeholderTextColor={colors.gray400} 
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat your password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </>}

          {step === 3 && <>
            <Text style={s.cardTitle}>Academic Information</Text>
            <View style={s.field}>
              <Text style={s.label}>Program / Course *</Text>
              <TextInput 
                style={s.input} 
                placeholderTextColor={colors.gray400} 
                value={program}
                onChangeText={setProgram}
                placeholder="e.g. Computer Science"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Verification Documents *</Text>
              <Text style={s.helperText}>Upload a clear photo of your student ID and a selfie to verify your identity.</Text>
              <TouchableOpacity style={s.uploadBtn} onPress={() => pickImage('id_photo')}>
                <Text style={s.uploadBtnText}>{idPhoto ? 'ID Photo Selected' : 'Upload ID Photo'}</Text>
              </TouchableOpacity>
              {idPhoto ? <Image source={{ uri: idPhoto }} style={s.previewImage} /> : null}
              <TouchableOpacity style={[s.uploadBtn, { marginTop: 10 }]} onPress={() => pickImage('selfie')}>
                <Text style={s.uploadBtnText}>{selfie ? 'Selfie Selected' : 'Upload Selfie'}</Text>
              </TouchableOpacity>
              {selfie ? <Image source={{ uri: selfie }} style={s.previewImage} /> : null}
            </View>
            <View style={s.field}>
              <Text style={s.label}>Level *</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {LEVELS.map(l => (
                  <TouchableOpacity key={l} onPress={() => setLevel(l)}
                    style={[s.levelBtn, level === l && s.levelBtnActive]}>
                    <Text style={[s.levelBtnText, level === l && { color: colors.white }]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={s.field}>
              <Text style={s.label}>Department</Text>
              <TextInput 
                style={s.input} 
                placeholderTextColor={colors.gray400} 
                value={department}
                onChangeText={setDepartment}
                placeholder="e.g. Computer Science"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Faculty/School</Text>
              <TextInput 
                style={s.input} 
                placeholderTextColor={colors.gray400} 
                value={faculty}
                onChangeText={setFaculty}
                placeholder="e.g. Faculty of Science"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Hall of Residence</Text>
              <TextInput 
                style={s.input} 
                placeholderTextColor={colors.gray400} 
                value={hall}
                onChangeText={setHall}
                placeholder="e.g. Commonwealth Hall"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </>}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
            {step > 1 && (
              <TouchableOpacity style={s.backBtn} onPress={() => setStep(s => s - 1)}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>← Back</Text>
              </TouchableOpacity>
            )}
            {step < 3
              ? <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={next}><Text style={s.btnText}>Next →</Text></TouchableOpacity>
              : <TouchableOpacity style={[s.btn, { flex: 1 }, loading && { opacity: 0.7 }]} onPress={handleRegister} disabled={loading}>
                  {loading ? <ActivityIndicator color={colors.white} /> : <Text style={s.btnText}>Create Account</Text>}
                </TouchableOpacity>
            }
          </View>

          <TouchableOpacity style={{ alignItems: 'center', marginTop: spacing.lg }} onPress={() => navigation.navigate('Login')}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              Already registered? <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={s.notice}>
          <Text style={s.noticeText}>🔒 Your device will be registered for security. One device per voter is enforced.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.primary },
  scroll:  { flexGrow: 1, padding: spacing.xl },
  header:  { alignItems: 'center', paddingVertical: spacing.xl },
  appName: { fontSize: 26, fontWeight: '800', color: colors.white },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  steps:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  stepDotActive: { backgroundColor: colors.white, borderColor: colors.white },
  stepNum: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  stepLine: { width: 48, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: colors.white },
  card:    { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xxl, ...shadow.md },
  cardTitle: { fontSize: 20, fontWeight: '700', color: colors.gray900, marginBottom: spacing.lg },
  field:   { marginBottom: spacing.md },
  label:   { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 6 },
  input:   { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.text },
  helperText: { fontSize: 12, color: colors.gray500, marginBottom: 10, lineHeight: 18 },
  uploadBtn: { backgroundColor: colors.primaryLight || '#e8f0ff', borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.primary },
  uploadBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  previewImage: { width: '100%', height: 180, borderRadius: radius.md, marginTop: 10, resizeMode: 'cover' },
  levelBtn: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  levelBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  levelBtnText: { fontSize: 13, fontWeight: '500', color: colors.gray600 },
  btn:     { backgroundColor: colors.primary, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  backBtn: { paddingVertical: 14, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  notice:  { marginTop: spacing.lg, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md },
  noticeText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
