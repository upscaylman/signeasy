import {
  AlertCircle,
  ChevronDown,
  Loader2,
  Plus,
  Shield,
  Trash2,
  Database,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addAuthorizedUser,
  getAuthorizedUsers,
  removeAuthorizedUser,
} from "../services/firebaseApi";
import Button from "./Button";
import DeleteUserDataModal from "./DeleteUserDataModal";
import { useToast } from "./Toast";

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<
    { id: string; email: string; addedAt: string }[]
  >([]);
  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Charger la liste des utilisateurs
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const data = await getAuthorizedUsers();
      setUsers(data);
    } catch (err) {
      console.error("Erreur loadUsers:", err);
      addToast("Erreur lors du chargement des utilisateurs", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!newEmail.trim()) {
      setError("Veuillez entrer une adresse e-mail.");
      return;
    }

    if (!emailRegex.test(newEmail)) {
      setError("Veuillez entrer une adresse e-mail valide.");
      return;
    }

    setIsAdding(true);
    try {
      const result = await addAuthorizedUser(newEmail.trim());
      if (result.success) {
        addToast(result.message, "success");
        setNewEmail("");
        setError("");
        await loadUsers();
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error("Erreur handleAddUser:", err);
      setError("Erreur lors de l'ajout de l'utilisateur.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveUser = async (email: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${email} ?`)) {
      try {
        const result = await removeAuthorizedUser(email);
        if (result.success) {
          addToast(result.message, "success");
          await loadUsers();
        } else {
          addToast(result.message, "error");
        }
      } catch (err) {
        console.error("Erreur handleRemoveUser:", err);
        addToast("Erreur lors de la suppression.", "error");
      }
    }
  };

  return (
    <div className="bg-surface rounded-3xl shadow-sm border border-outlineVariant/30">
      {/* Header cliquable pour collapse */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 hover:bg-surfaceVariant/30 transition-colors rounded-3xl"
      >
        <div className="flex items-center gap-3">
          <div className="bg-primaryContainer p-3 rounded-full">
            <Shield className="h-6 w-6 text-onPrimaryContainer" />
          </div>
          <div className="text-left">
            <h2 className="text-2xl font-bold text-onSurface">
              Gestion des Accès
            </h2>
            <p className="text-sm text-onSurfaceVariant mt-1">
              {users.length} utilisateur{users.length > 1 ? "s" : ""}{" "}
              personnalisé{users.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-6 w-6 text-onSurfaceVariant transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Contenu collapse */}
      {isOpen && (
        <div className="px-6 pb-6 space-y-6 animate-fade-in">
          {/* Formulaire d'ajout */}
          <div>
            <h3 className="text-lg font-semibold text-onSurface mb-4">
              Ajouter un utilisateur
            </h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="exemple@email.com"
                  className="flex-1 p-3 bg-surfaceVariant/60 border border-outlineVariant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary focus:bg-surface transition-colors"
                  disabled={isAdding}
                />
                <Button
                  type="submit"
                  variant="filled"
                  disabled={isAdding}
                  className="w-full sm:w-auto sm:min-w-fit"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                      Ajout...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2 inline" />
                      Ajouter
                    </>
                  )}
                </Button>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-errorContainer/30 border border-error/30 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}
            </form>
          </div>

          {/* Liste des utilisateurs */}
          <div>
            <h3 className="text-lg font-semibold text-onSurface mb-4">
              Utilisateurs autorisés (personnalisés)
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-onSurfaceVariant text-center py-8">
                Aucun utilisateur personnalisé pour le moment.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="relative group p-4 bg-surfaceVariant/40 rounded-xl border border-outlineVariant hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <div className="pr-8">
                      <p
                        className="font-medium text-onSurface truncate"
                        title={user.email}
                      >
                        {user.email}
                      </p>
                      <p className="text-xs text-onSurfaceVariant mt-1">
                        {new Date(user.addedAt).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveUser(user.email)}
                      className="absolute top-3 right-3 p-1.5 text-error hover:bg-errorContainer/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Supprimer cet utilisateur"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lien vers la page de suppression des données */}
          <div className="mt-6 pt-6 border-t border-outlineVariant">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-onSurface mb-1">
                  Suppression des données utilisateur
                </h3>
                <p className="text-xs text-onSurfaceVariant mb-2">
                  Supprimer toutes les données d'un utilisateur (documents, emails, tokens, etc.)
                </p>
                <a
                  href="#/admin/delete-user-data"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/admin/delete-user-data");
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Accéder à la page complète
                </a>
              </div>
              <Button
                variant="outlined"
                icon={Database}
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex-shrink-0"
                size="small"
              >
                Accéder
              </Button>
            </div>
          </div>

          <DeleteUserDataModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
          />

          <div className="mt-6 pt-6 border-t border-outlineVariant">
            <p className="text-xs text-onSurfaceVariant">
              <strong>Note :</strong> Les emails prédéfinis
              (marie-helenegl@fo-metaux.fr, corinnel@fo-metaux.fr,
              contact@fo-metaux.fr, vrodriguez@fo-metaux.fr,
              aguillermin@fo-metaux.fr) ne peuvent pas être supprimés. Les
              personnes qui ont reçu un document à signer ont automatiquement
              accès.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
