import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Users, Search, Edit2, Trash2, Shield, User } from 'lucide-react';
import { format } from 'date-fns';

const AVAILABLE_ROLES = [
  { id: 'admin', label: 'Admin', description: 'Full system access' },
  { id: 'trainer', label: 'Trainer', description: 'Can manage riders and sessions' },
  { id: 'rider', label: 'Rider', description: 'Basic rider access' },
  { id: 'guardian', label: 'Guardian', description: 'Can manage minor riders' },
  { id: 'stable_manager', label: 'Stable Manager', description: 'Can manage stables' },
];

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
      toast({ title: 'User updated successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update user', description: error.message, variant: 'destructive' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteConfirm(null);
      toast({ title: 'User deleted successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete user', description: error.message, variant: 'destructive' });
    },
  });

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase();
    return (
      user.email?.toLowerCase().includes(search) ||
      user.full_name?.toLowerCase().includes(search) ||
      user.first_name?.toLowerCase().includes(search) ||
      user.last_name?.toLowerCase().includes(search)
    );
  });

  const handleEditUser = (user) => {
    setEditingUser(user);
    setSelectedRoles(user.roles || []);
  };

  const handleSaveRoles = () => {
    if (editingUser) {
      updateUserMutation.mutate({
        id: editingUser.id,
        data: { roles: selectedRoles },
      });
    }
  };

  const toggleRole = (roleId) => {
    setSelectedRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(r => r !== roleId)
        : [...prev, roleId]
    );
  };

  const getRoleBadgeColor = (role) => {
    const roleLower = role.toLowerCase();
    switch (roleLower) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'trainer': return 'bg-blue-100 text-blue-800';
      case 'rider': return 'bg-green-100 text-green-800';
      case 'guardian': return 'bg-purple-100 text-purple-800';
      case 'stable_manager':
      case 'stablemanager': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const UserCard = ({ user }) => (
    <div className="p-4 border-b border-[#1B4332]/10 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {user.profile_image ? (
            <img src={user.profile_image} alt="" className="w-12 h-12 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#1B4332]/10 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-[#1B4332]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[#1B4332] truncate">
              {user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'No name'}
            </p>
            <p className="text-sm text-[#1B4332]/60 truncate">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEditUser(user)}
            className="text-[#1B4332] hover:bg-[#1B4332]/10"
          >
            <Edit2 className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteConfirm(user)}
            className="text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {user.roles?.length > 0 ? (
          user.roles.map((role) => (
            <Badge key={role} className={`${getRoleBadgeColor(role)} text-xs`}>
              {role}
            </Badge>
          ))
        ) : (
          <span className="text-[#1B4332]/40 text-sm">No roles</span>
        )}
      </div>
      <p className="mt-2 text-xs text-[#1B4332]/50">
        Joined {user.created_date ? format(new Date(user.created_date), 'MMM d, yyyy') : '-'}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="p-2 bg-[#1B4332]/10 rounded-lg">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#1B4332]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1B4332]">User Management</h1>
            <p className="text-xs sm:text-sm text-[#1B4332]/60">{users.length} users</p>
          </div>
        </div>

        <Card className="bg-white border-[#1B4332]/10">
          <CardHeader className="border-b border-[#1B4332]/10 p-3 sm:p-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1B4332]/40" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-[#1B4332]/20 border-t-[#1B4332] rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Mobile Card Layout */}
                <div className="md:hidden">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <UserCard key={user.id} user={user} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-[#1B4332]/60">
                      No users found
                    </div>
                  )}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {user.profile_image ? (
                                <img src={user.profile_image} alt="" className="w-10 h-10 rounded-full" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-[#1B4332]/10 flex items-center justify-center">
                                  <User className="w-5 h-5 text-[#1B4332]" />
                                </div>
                              )}
                              <span className="font-medium text-[#1B4332]">
                                {user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'No name'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-[#1B4332]/70">{user.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.roles?.length > 0 ? (
                                user.roles.map((role) => (
                                  <Badge key={role} className={getRoleBadgeColor(role)}>
                                    {role}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-[#1B4332]/40 text-sm">No roles</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-[#1B4332]/70">
                            {user.created_date ? format(new Date(user.created_date), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditUser(user)}
                                className="text-[#1B4332] hover:bg-[#1B4332]/10"
                              >
                                <Edit2 className="w-5 h-5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirm(user)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-5 h-5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-[#1B4332]/60">
                            No users found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Edit Roles Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#1B4332]" />
                Edit User Roles
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="mb-4">
                <p className="text-sm text-[#1B4332]/70 break-all">
                  Editing: <span className="font-medium text-[#1B4332]">{editingUser?.email}</span>
                </p>
              </div>
              <div className="space-y-2">
                {AVAILABLE_ROLES.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-[#1B4332]/10 hover:bg-[#1B4332]/5 cursor-pointer active:bg-[#1B4332]/10"
                    onClick={() => toggleRole(role.id)}
                  >
                    <Checkbox
                      checked={selectedRoles.map(r => r.toLowerCase()).includes(role.id)}
                      onCheckedChange={() => toggleRole(role.id)}
                      className="h-5 w-5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#1B4332]">{role.label}</p>
                      <p className="text-xs text-[#1B4332]/60">{role.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setEditingUser(null)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                onClick={handleSaveRoles}
                disabled={updateUserMutation.isPending}
                className="bg-[#1B4332] hover:bg-[#1B4332]/90 w-full sm:w-auto"
              >
                {updateUserMutation.isPending ? 'Saving...' : 'Save Roles'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle className="text-red-600">Delete User</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-[#1B4332]/70 break-all">
                Are you sure you want to delete <span className="font-medium text-[#1B4332]">{deleteConfirm?.email}</span>?
              </p>
              <p className="text-sm text-red-600 mt-2">This action cannot be undone.</p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteUserMutation.mutate(deleteConfirm.id)}
                disabled={deleteUserMutation.isPending}
                className="w-full sm:w-auto"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
